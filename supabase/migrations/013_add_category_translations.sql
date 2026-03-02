ALTER TABLE categories ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}';
