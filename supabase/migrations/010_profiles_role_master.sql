-- 기존 admin → master 변환 (constraint 변경 전에 데이터 먼저)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE profiles SET role = 'master' WHERE role = 'admin';
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'master'));
