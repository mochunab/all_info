CREATE OR REPLACE FUNCTION get_posts_without_sentiment(lim integer DEFAULT 30)
RETURNS TABLE (id uuid, title text, body text, source text) AS $$
  SELECT p.id, p.title, p.body, p.source
  FROM crypto_posts p
  LEFT JOIN crypto_sentiments s ON s.post_id = p.id
  WHERE s.id IS NULL
  ORDER BY p.posted_at DESC
  LIMIT lim;
$$ LANGUAGE sql STABLE;
