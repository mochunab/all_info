ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ko';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS translation_group_id uuid DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS blog_posts_language_idx ON blog_posts(language);
