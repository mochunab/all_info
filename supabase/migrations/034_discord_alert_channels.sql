-- Discord 봇 알림 채널 레지스트리
CREATE TABLE IF NOT EXISTS discord_alert_channels (
  guild_id text PRIMARY KEY,
  channel_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE discord_alert_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON discord_alert_channels FOR ALL USING (true) WITH CHECK (true);
