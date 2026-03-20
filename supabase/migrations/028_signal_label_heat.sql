-- signal_label: buy/sell → heat 스케일 전환
-- strong_buy → extremely_hot, buy → hot, neutral → warm, sell → cool, strong_sell → cold

-- 1. CHECK 제약조건 먼저 제거
ALTER TABLE crypto_signals DROP CONSTRAINT IF EXISTS crypto_signals_signal_label_check;

-- 2. 시그널 데이터 변환
UPDATE crypto_signals SET signal_label = CASE signal_label
  WHEN 'strong_buy' THEN 'extremely_hot'
  WHEN 'buy' THEN 'hot'
  WHEN 'neutral' THEN 'warm'
  WHEN 'sell' THEN 'cool'
  WHEN 'strong_sell' THEN 'cold'
  ELSE signal_label
END
WHERE signal_label IN ('strong_buy', 'buy', 'neutral', 'sell', 'strong_sell');

-- 3. 새 CHECK 제약조건 추가
ALTER TABLE crypto_signals ADD CONSTRAINT crypto_signals_signal_label_check
  CHECK (signal_label IN ('extremely_hot', 'hot', 'warm', 'cool', 'cold'));

-- 4. backtest 데이터 변환
UPDATE crypto_backtest_results SET signal_label = CASE signal_label
  WHEN 'strong_buy' THEN 'extremely_hot'
  WHEN 'buy' THEN 'hot'
  WHEN 'neutral' THEN 'warm'
  WHEN 'sell' THEN 'cool'
  WHEN 'strong_sell' THEN 'cold'
  ELSE signal_label
END
WHERE signal_label IN ('strong_buy', 'buy', 'neutral', 'sell', 'strong_sell');

-- 5. 집계 뷰 재생성
DROP VIEW IF EXISTS crypto_backtest_summary;
CREATE VIEW crypto_backtest_summary AS
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
  ROUND(AVG(price_change_pct) FILTER (WHERE signal_label IN ('extremely_hot', 'hot') AND evaluated_at IS NOT NULL), 2) AS avg_hot_return_pct,
  ROUND(AVG(price_change_pct) FILTER (WHERE signal_label IN ('cold', 'cool') AND evaluated_at IS NOT NULL), 2) AS avg_cold_return_pct
FROM crypto_backtest_results
GROUP BY signal_label, lookup_window;
