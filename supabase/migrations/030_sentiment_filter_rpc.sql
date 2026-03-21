-- 센티먼트 분석 대상 필터링 강화
-- 1) 코인 멘션이 1개 이상 있는 게시물만 (멘션 없으면 시그널에 기여 안 함)
-- 2) 제목+본문 합쳐서 30자 이상 (너무 짧으면 분석 무의미)
-- 3) source 컬럼 반환 (소스별 Edge Function 라우팅용)

CREATE OR REPLACE FUNCTION get_posts_without_sentiment(lim integer DEFAULT 200)
RETURNS TABLE (id uuid, title text, body text, source text) AS $$
  SELECT p.id, p.title, p.body, p.source
  FROM crypto_posts p
  INNER JOIN crypto_mentions m ON m.post_id = p.id
  LEFT JOIN crypto_sentiments s ON s.post_id = p.id
  WHERE s.id IS NULL
    AND (COALESCE(char_length(p.title), 0) + COALESCE(char_length(p.body), 0)) >= 30
  GROUP BY p.id, p.title, p.body, p.source
  ORDER BY p.posted_at DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;
