import * as cheerio from 'cheerio';
import { generateSourceId } from '@/lib/utils';
import {
  CrawledArticle,
  CrawlerConfig,
  DEFAULT_HEADERS,
  fetchWithTimeout,
  isWithinDays,
  parseDate,
} from './base';
import type { CrawlSource } from '@/types';

// Fetch HTML content with retry and timeout
async function fetchHtml(url: string, retries = 2): Promise<string> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Fetch] Attempting ${url} (try ${i + 1}/${retries})`);
      const response = await fetchWithTimeout(url, {
        headers: DEFAULT_HEADERS,
      }, 10000); // 10 second timeout

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      console.log(`[Fetch] Success: ${url} (${text.length} bytes)`);
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[Fetch] Failed ${url}: ${lastError.message}`);
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to fetch HTML');
}

// Extract absolute URL
function toAbsoluteUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const base = new URL(baseUrl);
  if (url.startsWith('//')) {
    return `${base.protocol}${url}`;
  }
  if (url.startsWith('/')) {
    return `${base.origin}${url}`;
  }

  return new URL(url, baseUrl).href;
}

// Generic Cheerio crawler
export async function crawlWithCheerio(
  source: CrawlSource,
  config: CrawlerConfig = {}
): Promise<CrawledArticle[]> {
  const articles: CrawledArticle[] = [];
  const sourceConfig = { ...config, ...(source.config as CrawlerConfig) };

  console.log(`[Cheerio] Crawling ${source.name}: ${source.base_url}`);

  const html = await fetchHtml(source.base_url);
  const $ = cheerio.load(html);

  // Get selectors from config or use defaults
  const selectors = sourceConfig.selectors || {};
  const listSelector = selectors.list || 'article, .article, .post, .item';
  const titleSelector = selectors.title || 'h2, h3, .title, .headline';
  const linkSelector = selectors.link || 'a';
  const thumbnailSelector = selectors.thumbnail || 'img';
  const dateSelector = selectors.date || '.date, time, .time, .published';
  const authorSelector = selectors.author || '.author, .writer, .byline';

  $(listSelector).each((_, element) => {
    try {
      const $el = $(element);

      // Extract link and title
      const $link = $el.find(linkSelector).first();
      const $title = $el.find(titleSelector).first();

      const href = $link.attr('href');
      const title = ($title.text() || $link.text()).trim();

      if (!href || !title) return;

      const sourceUrl = toAbsoluteUrl(href, source.base_url);
      const sourceId = generateSourceId(sourceUrl);

      // Extract thumbnail
      const $thumbnail = $el.find(thumbnailSelector).first();
      let thumbnailUrl = $thumbnail.attr('src') || $thumbnail.attr('data-src');
      if (thumbnailUrl) {
        thumbnailUrl = toAbsoluteUrl(thumbnailUrl, source.base_url);
      }

      // Extract date
      const $date = $el.find(dateSelector).first();
      const dateText = $date.attr('datetime') || $date.text();
      const publishedAt = dateText ? parseDate(dateText)?.toISOString() : undefined;

      console.log(`[Cheerio] Article: "${title.substring(0, 40)}..." | Raw date: ${dateText || 'N/A'} | Parsed: ${publishedAt || 'N/A'}`);

      // Check if within 7 days
      if (!isWithinDays(publishedAt, 14, title)) {
        console.log(`[Cheerio] SKIP (too old): ${title}`);
        return;
      }

      // Extract author
      const $author = $el.find(authorSelector).first();
      const author = $author.text().trim() || undefined;

      articles.push({
        source_id: sourceId,
        source_name: source.name,
        source_url: sourceUrl,
        title,
        thumbnail_url: thumbnailUrl,
        author,
        published_at: publishedAt,
        category: sourceConfig.category,
      });
    } catch (error) {
      console.error(`Error parsing article in ${source.name}:`, error);
    }
  });

  console.log(`[Cheerio] Found ${articles.length} articles from ${source.name}`);
  return articles;
}

// Fetch article content for preview
export async function fetchArticleContent(
  url: string,
  contentSelector?: string
): Promise<string | undefined> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Remove script, style, and nav elements
    $('script, style, nav, header, footer, aside, .ads, .comments').remove();

    // Get content
    const selector = contentSelector || 'article, .article-content, .post-content, main';
    const content = $(selector).first().text();

    // Clean and truncate
    const cleaned = content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000);

    return cleaned || undefined;
  } catch (error) {
    console.error(`Error fetching article content from ${url}:`, error);
    return undefined;
  }
}
