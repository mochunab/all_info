-- articles에 user_id 추가
ALTER TABLE articles ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
UPDATE articles SET user_id = 'c6ec0ad5-8e86-4157-92d0-801acfef9247';
ALTER TABLE articles ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX idx_articles_user_id ON articles(user_id);

-- categories에 user_id 추가
ALTER TABLE categories ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
UPDATE categories SET user_id = 'c6ec0ad5-8e86-4157-92d0-801acfef9247';
ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- crawl_sources에 user_id 추가
ALTER TABLE crawl_sources ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
UPDATE crawl_sources SET user_id = 'c6ec0ad5-8e86-4157-92d0-801acfef9247';
ALTER TABLE crawl_sources ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX idx_crawl_sources_user_id ON crawl_sources(user_id);
