-- Signal Scoring V2: Z-score, cross-platform, contrarian, event modifiers
ALTER TABLE crypto_signals ADD COLUMN IF NOT EXISTS z_score numeric(6,3);
ALTER TABLE crypto_signals ADD COLUMN IF NOT EXISTS source_count integer DEFAULT 1;
ALTER TABLE crypto_signals ADD COLUMN IF NOT EXISTS contrarian_warning text;
ALTER TABLE crypto_signals ADD COLUMN IF NOT EXISTS sentiment_skew numeric(5,2);
ALTER TABLE crypto_signals ADD COLUMN IF NOT EXISTS detected_events text[];
ALTER TABLE crypto_signals ADD COLUMN IF NOT EXISTS event_modifier numeric(5,2) DEFAULT 0;
