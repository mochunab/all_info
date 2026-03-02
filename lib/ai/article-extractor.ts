// LLM 아티클 추출 클라이언트
// Edge Function (Gemini) → 로컬 OpenAI fallback

import OpenAI from 'openai';
import type { RawContentItem } from '@/lib/crawlers/types';
import { processTitle } from '@/lib/crawlers/title-cleaner';
import { isWithinDays, MAX_ARTICLE_AGE_DAYS } from '@/lib/crawlers/date-parser';

type ExtractedArticle = {
  title: string;
  link: string;
  date: string | null;
  thumbnail: string | null;
};

const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/extract-articles`
  : null;

const EXTRACTION_PROMPT = `웹 페이지 HTML에서 아티클/뉴스/포스트 목록을 추출하라.

메인 콘텐츠 영역(aside/sidebar/nav/footer 제외)에서 반복되는 아이템을 찾아 각각의 title, link, date, thumbnail을 추출.

규칙:
- 제목 5자 이상만 포함
- javascript: 링크 제외
- 상대 URL은 그대로 반환
- 최대 20개

URL: {url}

HTML:
\`\`\`html
{html}
\`\`\`

JSON으로 응답:
{"articles": [{"title": "...", "link": "...", "date": "... 또는 null", "thumbnail": "... 또는 null"}]}`;

async function callEdgeFunction(html: string, url: string): Promise<ExtractedArticle[] | null> {
  if (!EDGE_FUNCTION_URL) return null;

  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) return null;

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ url, html }),
    });

    if (!response.ok) {
      console.warn(`[LLM-EXTRACT] Edge Function error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    if (result.success && Array.isArray(result.articles)) {
      return result.articles;
    }

    console.warn(`[LLM-EXTRACT] Edge Function failed:`, result.error);
    return null;
  } catch (error) {
    console.warn(`[LLM-EXTRACT] Edge Function request failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function callLocalOpenAI(html: string, url: string): Promise<ExtractedArticle[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = EXTRACTION_PROMPT
      .replace('{url}', url)
      .replace('{html}', html.substring(0, 30000));

    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2000,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.articles)) {
      return parsed.articles;
    }

    return null;
  } catch (error) {
    console.warn(`[LLM-EXTRACT] Local OpenAI failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

function resolveUrl(link: string, baseUrl: string): string | null {
  if (!link || link.startsWith('javascript:')) return null;
  if (link.startsWith('http://') || link.startsWith('https://')) return link;

  try {
    return new URL(link, baseUrl).href;
  } catch {
    return null;
  }
}

function toRawContentItems(articles: ExtractedArticle[], baseUrl: string): RawContentItem[] {
  const items: RawContentItem[] = [];

  for (const article of articles) {
    const title = processTitle(article.title);
    if (!title) continue;

    const link = resolveUrl(article.link, baseUrl);
    if (!link) continue;

    if (!isWithinDays(article.date, MAX_ARTICLE_AGE_DAYS)) continue;

    items.push({
      title,
      link,
      thumbnail: article.thumbnail ? resolveUrl(article.thumbnail, baseUrl) : null,
      author: null,
      dateStr: article.date,
    });
  }

  return items;
}

/**
 * LLM으로 HTML에서 아티클 직접 추출
 * 1차: Edge Function (Gemini) → 2차: 로컬 OpenAI → RawContentItem[] 변환
 */
export async function extractArticlesViaLLM(
  html: string,
  baseUrl: string
): Promise<RawContentItem[]> {
  console.log(`[LLM-EXTRACT] 1차: Edge Function (Gemini) 시도...`);
  let articles = await callEdgeFunction(html, baseUrl);

  if (!articles || articles.length === 0) {
    console.log(`[LLM-EXTRACT] 2차: 로컬 OpenAI fallback 시도...`);
    articles = await callLocalOpenAI(html, baseUrl);
  }

  if (!articles || articles.length === 0) {
    console.warn(`[LLM-EXTRACT] 추출 실패: 두 방법 모두 결과 없음`);
    return [];
  }

  console.log(`[LLM-EXTRACT] 원시 추출 결과: ${articles.length}건`);

  const items = toRawContentItems(articles, baseUrl);
  console.log(`[LLM-EXTRACT] 필터링 후 결과: ${items.length}건`);

  return items;
}
