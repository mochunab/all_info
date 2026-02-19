-- Add crawl_url column to crawl_sources table
-- This stores the optimized URL for crawling (if different from base_url)

ALTER TABLE crawl_sources
ADD COLUMN IF NOT EXISTS crawl_url TEXT;

COMMENT ON COLUMN crawl_sources.crawl_url IS '실제 크롤링에 사용될 최적화된 URL (NULL이면 base_url 사용)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_crawl_sources_crawl_url ON crawl_sources(crawl_url);
