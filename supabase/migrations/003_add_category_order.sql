-- Migration: Add display_order to categories table
-- Run this in Supabase SQL Editor

-- Add display_order column
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Set initial display_order based on existing order (id)
UPDATE categories
SET display_order = id
WHERE display_order IS NULL;

-- Make display_order NOT NULL
ALTER TABLE categories
ALTER COLUMN display_order SET NOT NULL;

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);
