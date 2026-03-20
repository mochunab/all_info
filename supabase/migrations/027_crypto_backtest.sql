-- 백테스팅 결과 테이블
CREATE TABLE IF NOT EXISTS crypto_backtest_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_symbol text NOT NULL,
  time_window text NOT NULL CHECK (time_window IN ('1h', '6h', '24h', '7d')),
  signal_label text NOT NULL,
  weighted_score numeric NOT NULL,
  signal_at timestamptz NOT NULL,
  price_at_signal numeric NOT NULL,
  price_after numeric,
  price_change_pct numeric,
  lookup_window text NOT NULL CHECK (lookup_window IN ('1h', '6h', '24h', '7d')),
  hit boolean,
  evaluated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_backtest_coin ON crypto_backtest_results (coin_symbol);
CREATE INDEX idx_backtest_signal_at ON crypto_backtest_results (signal_at);
CREATE INDEX idx_backtest_label ON crypto_backtest_results (signal_label);
CREATE UNIQUE INDEX idx_backtest_unique ON crypto_backtest_results (coin_symbol, time_window, signal_at, lookup_window);

ALTER TABLE crypto_backtest_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest_read_all" ON crypto_backtest_results FOR SELECT USING (true);
CREATE POLICY "backtest_service_write" ON crypto_backtest_results FOR ALL USING (true) WITH CHECK (true);

-- 집계 뷰: 라벨별 적중률 + 평균 수익률
CREATE OR REPLACE VIEW crypto_backtest_summary AS
SELECT
  signal_label,
  lookup_window,
  COUNT(*) FILTER (WHERE evaluated_at IS NOT NULL) AS total_evaluated,
  COUNT(*) FILTER (WHERE hit = true) AS wins,
  ROUND(
    COUNT(*) FILTER (WHERE hit = true)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE evaluated_at IS NOT NULL), 0) * 100, 1
  ) AS win_rate_pct,
  ROUND(AVG(price_change_pct) FILTER (WHERE evaluated_at IS NOT NULL), 2) AS avg_return_pct,
  ROUND(AVG(price_change_pct) FILTER (WHERE signal_label IN ('strong_buy', 'buy') AND evaluated_at IS NOT NULL), 2) AS avg_buy_return_pct,
  ROUND(AVG(price_change_pct) FILTER (WHERE signal_label IN ('strong_sell', 'sell') AND evaluated_at IS NOT NULL), 2) AS avg_sell_return_pct
FROM crypto_backtest_results
GROUP BY signal_label, lookup_window;
