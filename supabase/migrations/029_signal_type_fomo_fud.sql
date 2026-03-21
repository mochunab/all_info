-- FOMO/FUD 시그널 분리: signal_type 컬럼 추가

ALTER TABLE crypto_signals
  ADD COLUMN signal_type text NOT NULL DEFAULT 'fomo';

ALTER TABLE crypto_signals
  DROP CONSTRAINT IF EXISTS crypto_signals_coin_symbol_time_window_computed_at_key;

ALTER TABLE crypto_signals
  ADD CONSTRAINT crypto_signals_coin_time_type_computed_key
  UNIQUE (coin_symbol, time_window, signal_type, computed_at);

CREATE INDEX idx_crypto_signals_signal_type ON crypto_signals(signal_type);

ALTER TABLE crypto_backtest_results
  ADD COLUMN signal_type text NOT NULL DEFAULT 'fomo';

ALTER TABLE crypto_backtest_results
  DROP CONSTRAINT IF EXISTS crypto_backtest_results_coin_symbol_time_window_signal_at_look_key;

ALTER TABLE crypto_backtest_results
  ADD CONSTRAINT crypto_backtest_results_unique_v2
  UNIQUE (coin_symbol, time_window, signal_type, signal_at, lookup_window);

-- CHECK 제약: signal_type 값 제한
ALTER TABLE crypto_signals
  ADD CONSTRAINT crypto_signals_signal_type_check CHECK (signal_type IN ('fomo', 'fud'));
ALTER TABLE crypto_backtest_results
  ADD CONSTRAINT crypto_backtest_results_signal_type_check CHECK (signal_type IN ('fomo', 'fud'));

-- 집계 뷰 재생성 (signal_type 포함)
DROP VIEW IF EXISTS crypto_backtest_summary;
CREATE VIEW crypto_backtest_summary AS
SELECT
  signal_label,
  signal_type,
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
GROUP BY signal_label, signal_type, lookup_window;
