-- Drop thumbnail_url column from articles table
-- This column is no longer used by any crawling code or frontend
ALTER TABLE articles DROP COLUMN IF EXISTS thumbnail_url;
