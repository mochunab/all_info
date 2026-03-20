-- crypto_sentiments에 metadata JSONB 컬럼 추가 (LLM narratives/events 저장용)
ALTER TABLE crypto_sentiments ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
