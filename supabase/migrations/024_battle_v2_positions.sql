-- battle_positions: 포지션 추적 (30분 단위 매매, 부분 청산 지원)
CREATE TABLE IF NOT EXISTS battle_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player TEXT NOT NULL CHECK (player IN ('monkey', 'robot')),
  coin_symbol TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  initial_size NUMERIC NOT NULL,
  remaining_size NUMERIC NOT NULL,
  stop_loss_price NUMERIC,
  take_profit_stage INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  close_reason TEXT,
  realized_pnl NUMERIC NOT NULL DEFAULT 0,
  signal_snapshot JSONB,
  hold_until TIMESTAMPTZ,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- battle_trades v2: UNIQUE 제약 제거 + position_id 연결
ALTER TABLE battle_trades DROP CONSTRAINT IF EXISTS battle_trades_trade_date_player_key;
ALTER TABLE battle_trades ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES battle_positions(id);
ALTER TABLE battle_trades ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE battle_trades ADD COLUMN IF NOT EXISTS traded_at TIMESTAMPTZ DEFAULT NOW();

-- battle_portfolio: 현금 잔고 + 오픈 포지션 수 추적
ALTER TABLE battle_portfolio ADD COLUMN IF NOT EXISTS cash_balance NUMERIC;
ALTER TABLE battle_portfolio ADD COLUMN IF NOT EXISTS open_positions INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_battle_positions_player_status ON battle_positions (player, status);
CREATE INDEX IF NOT EXISTS idx_battle_positions_opened_at ON battle_positions (opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_battle_trades_position ON battle_trades (position_id);

-- RLS
ALTER TABLE battle_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read battle_positions" ON battle_positions FOR SELECT USING (true);
CREATE POLICY "Service write battle_positions" ON battle_positions FOR ALL USING (auth.role() = 'service_role');

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_battle_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_battle_positions_updated_at
  BEFORE UPDATE ON battle_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_battle_positions_updated_at();
