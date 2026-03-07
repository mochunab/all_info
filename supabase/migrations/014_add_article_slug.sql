ALTER TABLE articles ADD COLUMN slug TEXT UNIQUE;
CREATE INDEX idx_articles_slug ON articles(slug);
UPDATE articles SET slug = id::text WHERE slug IS NULL;
