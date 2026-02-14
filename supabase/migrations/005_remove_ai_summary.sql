-- Migration: Remove ai_summary column from articles table
-- This column was used for 1-line summaries (80 chars) but caused redundancy with the summary field
-- Now we only use summary (detailed_summary) which contains headline + description

-- Drop ai_summary column
ALTER TABLE articles DROP COLUMN IF EXISTS ai_summary;

-- Update comments
COMMENT ON COLUMN articles.summary IS '상세 요약 (헤드라인 + 2~3문장 설명)';
COMMENT ON COLUMN articles.summary_tags IS '핵심 키워드 태그 3개';
