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
