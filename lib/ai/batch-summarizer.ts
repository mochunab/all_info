import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  generateAISummary,
  type AISummaryResult,
} from './summarizer';

type BatchResult = {
  processed: number;
  success: number;
  failed: number;
  errors: string[];
};

type ArticleRow = {
  id: string;
  title: string;
  content_preview: string | null;
  summary?: string | null;
  summary_tags?: string[];
};

// Edge Function 우선 사용 (USE_EDGE_FUNCTION=false로 명시해야 로컬 OpenAI 직접 호출)
const USE_EDGE_FUNCTION = process.env.USE_EDGE_FUNCTION !== 'false';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// 재시도 래퍼 (최대 3회, 1초 간격)
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      const delaySeconds = (RETRY_DELAY_MS * attempt) / 1000;
      console.warn(`   ⚠️  재시도 ${attempt}/${MAX_RETRIES}: "${label}..." (${delaySeconds}초 대기)`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw new Error(`Unreachable`);
}

// Edge Function URL (Supabase project URL 기반)
const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/summarize-article`
  : null;

// Edge Function을 통한 AI 요약 생성
async function generateAISummaryViaEdgeFunction(
  title: string,
  content: string,
  supabaseKey: string
): Promise<AISummaryResult> {
  if (!EDGE_FUNCTION_URL) {
    return {
      summary_tags: [],
      detailed_summary: '',
      success: false,
      error: 'Edge Function URL not configured',
    };
  }

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Edge Function] Error:', response.status, errorText);
      return {
        summary_tags: [],
        detailed_summary: '',
        success: false,
        error: `Edge Function error: ${response.status}`,
      };
    }

    const result = await response.json();

    if (result.success) {
      return {
        summary_tags: result.summary_tags || [],
        detailed_summary: result.detailed_summary || '',
        success: true,
      };
    } else {
      return {
        summary_tags: [],
        detailed_summary: '',
        success: false,
        error: result.error || 'Unknown Edge Function error',
      };
    }
  } catch (error) {
    console.error('[Edge Function] Request failed:', error);
    return {
      summary_tags: [],
      detailed_summary: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Process pending summaries in batches (1회 호출로 summary + ai_summary + tags 생성)
export async function processPendingSummaries(
  supabase: SupabaseClient<Database>,
  batchSize = 20,
  supabaseKey?: string
): Promise<BatchResult> {
  const result: BatchResult = {
    processed: 0,
    success: 0,
    failed: 0,
    errors: [],
  };

  try {
    // 요약 없는 게시글 조회 (summary가 없는 것들)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: articlesData, error } = await (supabase as any)
      .from('articles')
      .select('id, title, content_preview, summary, summary_tags')
      .is('summary', null)
      .eq('is_active', true)
      .order('crawled_at', { ascending: false })
      .limit(batchSize);

    if (error || !articlesData) {
      console.error('❌ [AI 요약] 아티클 조회 실패:', error);
      result.errors.push(error?.message || 'Failed to fetch articles');
      return result;
    }

    const articles = articlesData as ArticleRow[];

    if (articles.length === 0) {
      console.log('ℹ️  [AI 요약] 요약 대기 중인 아티클 없음\n');
      return result;
    }

    const CONCURRENCY = 5;
    console.log(`\n📊 [AI 요약] ${articles.length}개 아티클 처리 시작 (${CONCURRENCY}개 동시 처리)\n`);

    // 5개씩 청크로 나누어 병렬 처리
    for (let i = 0; i < articles.length; i += CONCURRENCY) {
      const chunk = articles.slice(i, i + CONCURRENCY);
      const batchNum = Math.floor(i / CONCURRENCY) + 1;
      const totalBatches = Math.ceil(articles.length / CONCURRENCY);

      console.log(`🔄 [배치 ${batchNum}/${totalBatches}] ${chunk.length}개 아티클 처리 중...`);

      const chunkResults = await Promise.allSettled(
        chunk.map(async (article) => {
          if (!article.content_preview) {
            console.log(`   ⏭️  건너뜀: "${article.title.substring(0, 40)}..." (본문 없음)`);
            return { article, skipped: true } as const;
          }

          // Edge Function 우선, 실패 시 로컬 fallback (최대 3회 재시도)
          const aiResult = await withRetry(async () => {
            let res;
            if (USE_EDGE_FUNCTION && supabaseKey) {
              res = await generateAISummaryViaEdgeFunction(
                article.title,
                article.content_preview!,
                supabaseKey
              );
              if (!res.success) {
                console.log(`   🔄 Edge Function 실패, 로컬 OpenAI로 재시도: ${res.error}`);
                res = await generateAISummary(
                  article.title,
                  article.content_preview!
                );
              }
            } else {
              res = await generateAISummary(
                article.title,
                article.content_preview!
              );
            }
            if (!res.success) throw new Error(res.error || 'AI summary failed');
            return res;
          }, article.title.substring(0, 40));

          // DB 업데이트
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (supabase as any)
            .from('articles')
            .update({
              summary_tags: aiResult.summary_tags.length > 0 ? aiResult.summary_tags : [],
              summary: aiResult.detailed_summary || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', article.id);

          if (updateError) {
            throw new Error(`Update failed: ${article.title} - ${updateError.message}`);
          }

          console.log(`   ✅ 요약 완료: "${article.title.substring(0, 50)}..."`);
          return { article, skipped: false } as const;
        })
      );

      // 청크 결과 집계
      for (const settled of chunkResults) {
        result.processed++;
        if (settled.status === 'fulfilled') {
          if (settled.value.skipped) {
            result.failed++;
          } else {
            result.success++;
          }
        } else {
          result.failed++;
          result.errors.push(settled.reason?.message || 'Unknown error');
          console.error(`   ❌ 오류:`, settled.reason);
        }
      }

      console.log(`   📊 배치 ${batchNum} 완료: ${chunk.length}개 처리\n`);
    }
  } catch (error) {
    console.error('❌ [AI 요약] 배치 처리 오류:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  const successRate = result.processed > 0
    ? ((result.success / result.processed) * 100).toFixed(1)
    : '0';

  console.log(`\n✅ [AI 요약] 배치 완료: ${result.success}/${result.processed}개 성공 (${successRate}%)\n`);
  return result;
}

// Process a single article
export async function processArticleSummary(
  supabase: SupabaseClient<Database>,
  articleId: string,
  supabaseKey?: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    // Fetch article
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: articleData, error: fetchError } = await (supabase as any)
      .from('articles')
      .select('id, title, content_preview, summary, summary_tags')
      .eq('id', articleId)
      .single();

    if (fetchError || !articleData) {
      return { success: false, error: 'Article not found' };
    }

    const article = articleData as ArticleRow;

    // Skip if already has summary
    if (article.summary) {
      return { success: true, summary: article.summary };
    }

    // Skip if no content
    if (!article.content_preview) {
      return { success: false, error: 'No content available' };
    }

    // Generate AI summary (Edge Function 우선, 실패 시 로컬 fallback)
    const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let aiResult;

    if (USE_EDGE_FUNCTION && key) {
      console.log(`[AI] Using Edge Function for: ${article.title.substring(0, 40)}...`);
      aiResult = await generateAISummaryViaEdgeFunction(
        article.title,
        article.content_preview,
        key
      );
      if (!aiResult.success) {
        console.log(`[AI] Edge Function failed, falling back to local: ${aiResult.error}`);
        aiResult = await generateAISummary(
          article.title,
          article.content_preview
        );
      }
    } else {
      aiResult = await generateAISummary(
        article.title,
        article.content_preview
      );
    }

    if (!aiResult.success) {
      return { success: false, error: aiResult.error };
    }

    // Update article
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('articles')
      .update({
        summary_tags: aiResult.summary_tags,
        summary: aiResult.detailed_summary || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, summary: aiResult.detailed_summary };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
