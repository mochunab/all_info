import type { SupabaseClient } from '@supabase/supabase-js';
import type { CryptoSentimentResult } from '@/types/crypto';
import {
  SENTIMENT_MAX_RETRIES,
  SENTIMENT_RETRY_DELAY_MS,
  POST_BODY_TRUNCATE_LENGTH,
} from '@/lib/crypto/config';

const BATCH_CHUNK_SIZE = 10;

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

type BatchEdgeResult = {
  success: boolean;
  results?: (CryptoSentimentResult & { id?: string })[];
  error?: string;
};

async function analyzeBatchViaEdgeFunction(
  posts: PostRow[],
  supabaseKey: string,
  source?: string
): Promise<BatchEdgeResult> {
  const edgeFunctionUrl = getEdgeFunctionUrl(source);
  if (!edgeFunctionUrl) {
    return { success: false, error: 'Edge Function URL not configured' };
  }

  const payload = posts.map(p => ({
    id: p.id,
    title: p.title,
    body: p.body && p.body.length > POST_BODY_TRUNCATE_LENGTH
      ? p.body.substring(0, POST_BODY_TRUNCATE_LENGTH) + '...'
      : p.body,
  }));

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ posts: payload }),
  });

  if (!response.ok) {
    return { success: false, error: `Edge Function error: ${response.status}` };
  }

  const result = await response.json();
  return { success: true, results: result.results || [] };
}

// 단일 게시물 폴백 (배치 실패 시)
async function analyzeSingleViaEdgeFunction(
  post: PostRow,
  supabaseKey: string,
): Promise<CryptoSentimentResult & { success: boolean; error?: string }> {
  const edgeFunctionUrl = getEdgeFunctionUrl(post.source);
  if (!edgeFunctionUrl) {
    return {
      sentiment_score: 0, sentiment_label: 'neutral', confidence: 0,
      mentioned_coins: [], key_phrases: [], fomo_score: 0, fud_score: 0,
      reasoning: '', success: false, error: 'Edge Function URL not configured',
    };
  }

  const truncatedBody = post.body && post.body.length > POST_BODY_TRUNCATE_LENGTH
    ? post.body.substring(0, POST_BODY_TRUNCATE_LENGTH) + '...'
    : post.body;

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ title: post.title, body: truncatedBody }),
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

async function saveSentiment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  postId: string,
  aiResult: CryptoSentimentResult,
) {
  const sentimentMetadata: Record<string, unknown> = {};
  if (aiResult.narratives && aiResult.narratives.length > 0) {
    sentimentMetadata.narratives = aiResult.narratives;
  }
  if (aiResult.events && aiResult.events.length > 0) {
    sentimentMetadata.events = aiResult.events;
  }

  const { error } = await supabase
    .from('crypto_sentiments')
    .upsert({
      post_id: postId,
      sentiment_score: aiResult.sentiment_score,
      sentiment_label: aiResult.sentiment_label,
      confidence: aiResult.confidence,
      key_phrases: aiResult.key_phrases,
      fomo_score: aiResult.fomo_score,
      fud_score: aiResult.fud_score,
      mentioned_coins: aiResult.mentioned_coins,
      reasoning: aiResult.reasoning,
      model_used: 'gemini-2.5-flash',
      metadata: sentimentMetadata,
    }, { onConflict: 'post_id' });

  if (error) throw new Error(`DB insert failed: ${error.message}`);
}

export async function processCryptoSentiments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  batchSize = 100,
  timeBudgetMs?: number
): Promise<BatchResult & { completed: boolean }> {
  const result: BatchResult = { processed: 0, success: 0, failed: 0, errors: [] };

  try {
    const { data: postsData, error } = await supabase
      .rpc('get_posts_without_sentiment', { lim: batchSize });

    if (error || !postsData || postsData.length === 0) {
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

  console.log(`\n🧠 [센티먼트] ${posts.length}개 게시물 처리 시작 (${BATCH_CHUNK_SIZE}개씩 배치)\n`);

  // 소스별로 그룹핑 (threads는 별도 Edge Function)
  const threadsPosts = posts.filter(p => p.source === 'threads');
  const otherPosts = posts.filter(p => p.source !== 'threads');

  const allGroups: { posts: PostRow[]; source?: string }[] = [];
  for (let i = 0; i < otherPosts.length; i += BATCH_CHUNK_SIZE) {
    allGroups.push({ posts: otherPosts.slice(i, i + BATCH_CHUNK_SIZE) });
  }
  for (let i = 0; i < threadsPosts.length; i += BATCH_CHUNK_SIZE) {
    allGroups.push({ posts: threadsPosts.slice(i, i + BATCH_CHUNK_SIZE), source: 'threads' });
  }

  for (const group of allGroups) {
    if (timeBudgetMs && (Date.now() - callStart) > timeBudgetMs) {
      console.log(`⏰ [센티먼트] 시간 제한 도달 — 남은 게시물 다음 실행으로 연기`);
      return { ...result, completed: false };
    }

    try {
      if (!USE_EDGE_FUNCTION || !supabaseKey) {
        throw new Error('No analysis method available');
      }

      const batchResult = await withRetry(
        () => analyzeBatchViaEdgeFunction(group.posts, supabaseKey, group.source),
        `배치 ${group.posts.length}개`
      );

      if (!batchResult.success || !batchResult.results) {
        throw new Error(batchResult.error || 'Batch failed');
      }

      // 배치 결과 저장
      for (let i = 0; i < group.posts.length; i++) {
        const post = group.posts[i];
        const aiResult = batchResult.results[i];
        if (!aiResult) {
          result.processed++;
          result.failed++;
          continue;
        }
        try {
          await saveSentiment(supabase, post.id, aiResult);
          result.processed++;
          result.success++;
          console.log(`   ✅ ${post.title.substring(0, 50)}... → ${aiResult.sentiment_label}`);
        } catch (e) {
          result.processed++;
          result.failed++;
          result.errors.push(e instanceof Error ? e.message : 'DB error');
        }
      }
    } catch (batchError) {
      // 배치 실패 → 개별 폴백
      console.warn(`   ⚠️  배치 실패, 개별 처리로 폴백: ${batchError instanceof Error ? batchError.message : 'unknown'}`);

      for (const post of group.posts) {
        try {
          const aiResult = await withRetry(
            () => analyzeSingleViaEdgeFunction(post, supabaseKey),
            post.title.substring(0, 40)
          );
          if (!aiResult.success) throw new Error(aiResult.error || 'Failed');
          await saveSentiment(supabase, post.id, aiResult);
          result.processed++;
          result.success++;
          console.log(`   ✅ (개별) ${post.title.substring(0, 50)}... → ${aiResult.sentiment_label}`);
        } catch (e) {
          result.processed++;
          result.failed++;
          result.errors.push(e instanceof Error ? e.message : 'Unknown error');
          console.error(`   ❌ 오류:`, e instanceof Error ? e.message : e);
        }
      }
    }
  }

  return { ...result, completed: true };
}
