-- Migration: Add AI Summary and Tags
-- Run this in Supabase SQL Editor

-- Add ai_summary (1-line summary, 80 chars) and summary_tags (3 tags) to articles
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS summary_tags TEXT[] DEFAULT '{}';

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, is_default) VALUES
  ('비즈니스', TRUE),
  ('소비 트렌드', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Add category_id to crawl_sources for linking
ALTER TABLE crawl_sources
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id);
