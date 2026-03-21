-- 트레일링 스탑용 최고가 추적 컬럼
ALTER TABLE battle_positions ADD COLUMN IF NOT EXISTS peak_price FLOAT DEFAULT NULL;
UPDATE battle_positions SET peak_price = entry_price WHERE peak_price IS NULL;
