import { generateSourceId } from '@/lib/utils';
import {
  CrawledArticle,
  CrawlerConfig,
  isWithinDays,
  parseDate,
} from './base';
import type { CrawlSource } from '@/types';

// Note: Playwright is heavy for serverless environments.
// For production, consider using a dedicated crawling service or
// running Playwright on a separate server (Railway, Render, etc.)
// This implementation uses a simplified approach with fetch for now.

// Placeholder for Playwright crawling
// In production, you would implement actual Playwright logic here
export async function crawlWithPlaywright(
  source: CrawlSource,
  _config: CrawlerConfig = {}
): Promise<CrawledArticle[]> {
  // Config is available for future use with actual Playwright implementation
  void _config;

  console.log(`[Playwright] Crawling ${source.name}: ${source.base_url}`);
  console.log(`[Playwright] Note: Using fetch-based fallback for serverless compatibility`);

  // For serverless environments, we use a fetch-based approach
  // that simulates basic dynamic content handling
  try {
    const response = await fetch(source.base_url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // For dynamic sites, we need site-specific parsers
    // This is a placeholder that returns empty array
    // The actual implementation should be in site-specific crawlers
    console.log(`[Playwright] Fetched ${html.length} bytes from ${source.name}`);

    return [];
  } catch (error) {
    console.error(`[Playwright] Error crawling ${source.name}:`, error);
    return [];
  }
}

// Helper to create article from extracted data
export function createArticle(
  data: {
    url: string;
    title: string;
    thumbnail?: string;
    author?: string;
    date?: string;
  },
  sourceName: string,
  category?: string
): CrawledArticle | null {
  if (!data.url || !data.title) return null;

  const publishedAt = data.date ? parseDate(data.date)?.toISOString() : undefined;

  // Skip if older than 7 days
  if (!isWithinDays(publishedAt, 14)) return null;

  return {
    source_id: generateSourceId(data.url),
    source_name: sourceName,
    source_url: data.url,
    title: data.title.trim(),
    thumbnail_url: data.thumbnail,
    author: data.author?.trim(),
    published_at: publishedAt,
    category,
  };
}
