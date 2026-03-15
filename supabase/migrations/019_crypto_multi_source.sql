-- 멀티 소스 지원: reddit_id → source_id, source 컬럼 추가

-- 1. source 컬럼 추가
ALTER TABLE crypto_posts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'reddit';

-- 2. source_id 컬럼 추가 (reddit_id 값 복사)
ALTER TABLE crypto_posts ADD COLUMN IF NOT EXISTS source_id text;
UPDATE crypto_posts SET source_id = reddit_id WHERE source_id IS NULL;
ALTER TABLE crypto_posts ALTER COLUMN source_id SET NOT NULL;

-- 3. 기존 reddit_id UNIQUE 제약 제거 → source_id UNIQUE로 교체
ALTER TABLE crypto_posts DROP CONSTRAINT IF EXISTS crypto_posts_reddit_id_unique;
ALTER TABLE crypto_posts ADD CONSTRAINT crypto_posts_source_id_unique UNIQUE (source_id);

-- 4. reddit_id 컬럼 제거
ALTER TABLE crypto_posts DROP COLUMN IF EXISTS reddit_id;

-- 5. source 인덱스
CREATE INDEX IF NOT EXISTS idx_crypto_posts_source ON crypto_posts (source);

-- 6. subreddit → channel 리네임 (범용화)
ALTER TABLE crypto_posts RENAME COLUMN subreddit TO channel;
