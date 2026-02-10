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
  ai_summary?: string | null;
  summary_tags?: string[];
};

// Edge Function 우선 사용 (USE_EDGE_FUNCTION=false로 명시해야 로컬 OpenAI 직접 호출)
const USE_EDGE_FUNCTION = process.env.USE_EDGE_FUNCTION !== 'false';

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
      summary: '',
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
        summary: '',
        summary_tags: [],
        detailed_summary: '',
        success: false,
        error: `Edge Function error: ${response.status}`,
      };
    }

    const result = await response.json();

    if (result.success) {
      return {
        summary: result.summary || '',
        summary_tags: result.summary_tags || [],
        detailed_summary: result.detailed_summary || '',
        success: true,
      };
    } else {
      return {
        summary: '',
        summary_tags: [],
        detailed_summary: '',
        success: false,
        error: result.error || 'Unknown Edge Function error',
      };
    }
  } catch (error) {
    console.error('[Edge Function] Request failed:', error);
    return {
      summary: '',
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
    // 요약 없는 게시글 조회 (ai_summary가 없는 것들)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: articlesData, error } = await (supabase as any)
      .from('articles')
      .select('id, title, content_preview, summary, ai_summary, summary_tags')
      .is('ai_summary', null)
      .eq('is_active', true)
      .order('crawled_at', { ascending: false })
      .limit(batchSize);

    if (error || !articlesData) {
      console.error('Failed to fetch articles:', error);
      result.errors.push(error?.message || 'Failed to fetch articles');
      return result;
    }

    const articles = articlesData as ArticleRow[];

    if (articles.length === 0) {
      console.log('No articles pending summarization');
      return result;
    }

    console.log(`Processing ${articles.length} articles for summarization`);

    for (const article of articles) {
      result.processed++;

      try {
        // Skip if no content
        if (!article.content_preview) {
          console.log(`Skipping ${article.title}: No content preview`);
          result.failed++;
          continue;
        }

        // Generate AI summary (1-line + 3 tags + detailed summary)
        // Edge Function 사용 시 서버에서 GPT-5-nano 호출
        let aiResult;
        if (USE_EDGE_FUNCTION && supabaseKey) {
          console.log(`[AI] Using Edge Function for: ${article.title.substring(0, 40)}...`);
          aiResult = await generateAISummaryViaEdgeFunction(
            article.title,
            article.content_preview,
            supabaseKey
          );
          // Edge Function 실패 시 로컬 fallback
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

        // Update article with unified summary result
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('articles')
          .update({
            ai_summary: aiResult.summary || null,
            summary_tags: aiResult.summary_tags.length > 0 ? aiResult.summary_tags : [],
            summary: aiResult.detailed_summary || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', article.id);

        if (updateError) {
          console.error(
            `Failed to update summary for ${article.title}:`,
            updateError
          );
          result.failed++;
          result.errors.push(`Update failed: ${article.title}`);
        } else {
          console.log(`Summary generated for: ${article.title}`);
          result.success++;
        }
      } catch (error) {
        console.error(`Error processing ${article.title}:`, error);
        result.failed++;
        result.errors.push(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      // API 호출 간격 (rate limit 방지)
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error('Batch summarization error:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  console.log(
    `Batch complete: ${result.success}/${result.processed} successful`
  );
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
      .select('id, title, content_preview, summary, ai_summary, summary_tags')
      .eq('id', articleId)
      .single();

    if (fetchError || !articleData) {
      return { success: false, error: 'Article not found' };
    }

    const article = articleData as ArticleRow;

    // Skip if already has ai_summary
    if (article.ai_summary) {
      return { success: true, summary: article.ai_summary };
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
        ai_summary: aiResult.summary,
        summary_tags: aiResult.summary_tags,
        summary: aiResult.detailed_summary || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, summary: aiResult.summary };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
