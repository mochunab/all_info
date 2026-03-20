-- battle_trades: 매일 1건씩 monkey/robot 거래 기록
CREATE TABLE IF NOT EXISTS battle_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_date DATE NOT NULL,
  player TEXT NOT NULL CHECK (player IN ('monkey', 'robot')),
  coin_symbol TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell')),
  entry_price NUMERIC NOT NULL,
  trade_size NUMERIC NOT NULL DEFAULT 10,
  price_at_close NUMERIC,
  pnl NUMERIC,
  signal_label TEXT,
  weighted_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trade_date, player)
);

-- battle_portfolio: 일별 포트폴리오 스냅샷
CREATE TABLE IF NOT EXISTS battle_portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  player TEXT NOT NULL CHECK (player IN ('monkey', 'robot')),
  portfolio_value NUMERIC NOT NULL DEFAULT 100,
  total_trades INTEGER NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (snapshot_date, player)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_battle_trades_date ON battle_trades (trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_battle_portfolio_date ON battle_portfolio (snapshot_date DESC);

-- RLS
ALTER TABLE battle_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read battle_trades" ON battle_trades FOR SELECT USING (true);
CREATE POLICY "Service write battle_trades" ON battle_trades FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read battle_portfolio" ON battle_portfolio FOR SELECT USING (true);
CREATE POLICY "Service write battle_portfolio" ON battle_portfolio FOR ALL USING (auth.role() = 'service_role');
