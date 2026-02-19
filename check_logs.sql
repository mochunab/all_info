-- crawl_logs 에러 확인
SELECT 
  id,
  source_id,
  started_at,
  finished_at,
  status,
  articles_found,
  articles_new,
  error_message
FROM crawl_logs
WHERE source_id IN (44, 45, 46, 47)
ORDER BY started_at DESC
LIMIT 20;
