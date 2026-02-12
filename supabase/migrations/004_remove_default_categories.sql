-- Migration: Remove default categories (비즈니스, 소비 트렌드)
-- Run this in Supabase SQL Editor

-- Delete default categories and their associated sources
DELETE FROM categories
WHERE name IN ('비즈니스', '소비 트렌드');

-- Note: This will also cascade delete crawl_sources with these categories
-- due to the foreign key constraint on category_id
