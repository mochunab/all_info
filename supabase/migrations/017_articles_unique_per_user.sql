-- 멀티유저 아티클 지원: 같은 URL의 아티클을 유저별로 저장 가능하게 변경
ALTER TABLE articles DROP CONSTRAINT articles_source_id_key;
ALTER TABLE articles ADD CONSTRAINT articles_source_id_user_id_key UNIQUE (source_id, user_id);
