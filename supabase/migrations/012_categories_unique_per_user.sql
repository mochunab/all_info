-- categories: unique constraint 변경 (name → user_id + name)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_user_name_unique UNIQUE (user_id, name);
