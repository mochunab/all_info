import type { SupabaseClient } from '@supabase/supabase-js';
import type { CryptoSentimentResult } from '@/types/crypto';
import {
  SENTIMENT_CONCURRENCY,
  SENTIMENT_MAX_RETRIES,
  SENTIMENT_RETRY_DELAY_MS,
  POST_BODY_TRUNCATE_LENGTH,
} from '@/lib/crypto/config';

type BatchResult = {
  processed: number;
  success: number;
  failed: number;
  errors: string[];
};

type PostRow = {
  id: string;
  title: string;
  body: string | null;
  source?: string;
};

const USE_EDGE_FUNCTION = process.env.USE_EDGE_FUNCTION !== 'false';

const SUPABASE_FN_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
  : null;

function getEdgeFunctionUrl(source?: string): string | null {
  if (!SUPABASE_FN_BASE) return null;
  if (source === 'threads') return `${SUPABASE_FN_BASE}/analyze-threads-sentiment`;
  return `${SUPABASE_FN_BASE}/analyze-crypto-sentiment`;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= SENTIMENT_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === SENTIMENT_MAX_RETRIES) throw error;
      console.warn(`   ⚠️  재시도 ${attempt}/${SENTIMENT_MAX_RETRIES}: "${label}" (${SENTIMENT_RETRY_DELAY_MS * attempt}ms)`);
      await new Promise((r) => setTimeout(r, SENTIMENT_RETRY_DELAY_MS * attempt));
    }
  }
  throw new Error('Unreachable');
}

async function analyzeViaEdgeFunction(
  title: string,
  body: string | null,
  supabaseKey: string,
  source?: string
): Promise<CryptoSentimentResult & { success: boolean; error?: string }> {
  const edgeFunctionUrl = getEdgeFunctionUrl(source);
  if (!edgeFunctionUrl) {
    return {
      sentiment_score: 0, sentiment_label: 'neutral', confidence: 0,
      mentioned_coins: [], key_phrases: [], fomo_score: 0, fud_score: 0,
      reasoning: '', success: false, error: 'Edge Function URL not configured',
    };
  }

  const truncatedBody = body && body.length > POST_BODY_TRUNCATE_LENGTH
    ? body.substring(0, POST_BODY_TRUNCATE_LENGTH) + '...'
    : body;

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ title, body: truncatedBody }),
  });

  if (!response.ok) {
    return {
      sentiment_score: 0, sentiment_label: 'neutral', confidence: 0,
      mentioned_coins: [], key_phrases: [], fomo_score: 0, fud_score: 0,
      reasoning: '', success: false, error: `Edge Function error: ${response.status}`,
    };
  }

  const result = await response.json();
  return { ...result, success: result.success !== false };
}

export async function processCryptoSentiments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  batchSize = 30,
  timeBudgetMs?: number
): Promise<BatchResult & { completed: boolean }> {
  const result: BatchResult = { processed: 0, success: 0, failed: 0, errors: [] };

  try {
    const { data: postsData, error } = await supabase
      .from('crypto_posts')
      .select('id, title, body, source')
      .not('id', 'in', supabase.from('crypto_sentiments').select('post_id'))
      .order('posted_at', { ascending: false })
      .limit(batchSize);

    // fallback: LEFT JOIN 방식
    if (error || !postsData) {
      const { data: fallbackData, error: fbError } = await supabase
        .rpc('get_posts_without_sentiment', { lim: batchSize });

      if (fbError || !fallbackData || fallbackData.length === 0) {
        console.log('ℹ️  [센티먼트] 분석 대기 중인 게시물 없음');
        return { ...result, completed: true };
      }

      return processPostBatch(supabase, fallbackData as PostRow[], result, timeBudgetMs);
    }

    if (postsData.length === 0) {
      console.log('ℹ️  [센티먼트] 분석 대기 중인 게시물 없음');
      return { ...result, completed: true };
    }

    return processPostBatch(supabase, postsData as PostRow[], result, timeBudgetMs);
  } catch (error) {
    console.error('❌ [센티먼트] 배치 처리 오류:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return { ...result, completed: true };
  }
}

async function processPostBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  posts: PostRow[],
  result: BatchResult,
  timeBudgetMs?: number
): Promise<BatchResult & { completed: boolean }> {
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const callStart = Date.now();

  console.log(`\n🧠 [센티먼트] ${posts.length}개 게시물 처리 시작 (${SENTIMENT_CONCURRENCY}개 동시)\n`);

  for (let i = 0; i < posts.length; i += SENTIMENT_CONCURRENCY) {
    if (timeBudgetMs && (Date.now() - callStart) > timeBudgetMs) {
      console.log(`⏰ [센티먼트] 시간 제한 도달 — ${posts.length - i}개 게시물 다음 실행으로 연기`);
      return { ...result, completed: false };
    }

    const chunk = posts.slice(i, i + SENTIMENT_CONCURRENCY);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (post) => {
        const aiResult = await withRetry(async () => {
          if (USE_EDGE_FUNCTION && supabaseKey) {
            const res = await analyzeViaEdgeFunction(post.title, post.body, supabaseKey, post.source);
            if (!res.success) throw new Error(res.error || 'Edge Function failed');
            return res;
          }
          throw new Error('No analysis method available');
        }, post.title.substring(0, 40));

        const { error: insertError } = await supabase
          .from('crypto_sentiments')
          .upsert({
            post_id: post.id,
            sentiment_score: aiResult.sentiment_score,
            sentiment_label: aiResult.sentiment_label,
            confidence: aiResult.confidence,
            key_phrases: aiResult.key_phrases,
            fomo_score: aiResult.fomo_score,
            fud_score: aiResult.fud_score,
            mentioned_coins: aiResult.mentioned_coins,
            reasoning: aiResult.reasoning,
            model_used: 'gemini-2.5-flash-lite',
          }, { onConflict: 'post_id' });

        if (insertError) throw new Error(`DB insert failed: ${insertError.message}`);

        console.log(`   ✅ 분석 완료: "${post.title.substring(0, 50)}..." → ${aiResult.sentiment_label}`);
        return post;
      })
    );

    for (const settled of chunkResults) {
      result.processed++;
      if (settled.status === 'fulfilled') {
        result.success++;
      } else {
        result.failed++;
        result.errors.push(settled.reason?.message || 'Unknown error');
        console.error(`   ❌ 오류:`, settled.reason?.message);
      }
    }
  }

  return { ...result, completed: true };
}
