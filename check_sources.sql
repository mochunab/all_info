-- crawl_sources 상세 정보 확인
SELECT 
  id, 
  name, 
  is_active, 
  crawler_type,
  config,
  last_crawled_at
FROM crawl_sources
WHERE id IN (44, 45, 46, 47)
ORDER BY id;
