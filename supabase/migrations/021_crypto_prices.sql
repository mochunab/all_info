-- 코인 마스터 목록 (CoinGecko 동기화) + 가격 스냅샷

-- crypto_coins: CoinGecko 코인 마스터
CREATE TABLE IF NOT EXISTS crypto_coins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coingecko_id text NOT NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  image_url text,
  market_cap_rank integer,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT crypto_coins_coingecko_id_unique UNIQUE (coingecko_id)
);

CREATE INDEX IF NOT EXISTS idx_crypto_coins_symbol ON crypto_coins (symbol);
CREATE INDEX IF NOT EXISTS idx_crypto_coins_rank ON crypto_coins (market_cap_rank);

ALTER TABLE crypto_coins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crypto_coins_select" ON crypto_coins FOR SELECT USING (true);
CREATE POLICY "crypto_coins_insert" ON crypto_coins FOR INSERT WITH CHECK (true);
CREATE POLICY "crypto_coins_update" ON crypto_coins FOR UPDATE USING (true);

CREATE TRIGGER crypto_coins_updated_at
  BEFORE UPDATE ON crypto_coins
  FOR EACH ROW EXECUTE FUNCTION update_crypto_updated_at();

-- crypto_prices: 가격 스냅샷
CREATE TABLE IF NOT EXISTS crypto_prices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coingecko_id text NOT NULL REFERENCES crypto_coins(coingecko_id) ON DELETE CASCADE,
  price_usd numeric(20,8) NOT NULL,
  market_cap numeric(20,2),
  volume_24h numeric(20,2),
  price_change_24h numeric(10,4),
  price_change_pct_24h numeric(8,4),
  circulating_supply numeric(20,2),
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crypto_prices_coingecko_id ON crypto_prices (coingecko_id);
CREATE INDEX IF NOT EXISTS idx_crypto_prices_fetched_at ON crypto_prices (fetched_at DESC);

ALTER TABLE crypto_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crypto_prices_select" ON crypto_prices FOR SELECT USING (true);
CREATE POLICY "crypto_prices_insert" ON crypto_prices FOR INSERT WITH CHECK (true);
