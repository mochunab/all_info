import 'dotenv/config';

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export const DISCORD_BOT_TOKEN = required('DISCORD_BOT_TOKEN');
export const DISCORD_CLIENT_ID = required('DISCORD_CLIENT_ID');
export const SUPABASE_URL = required('SUPABASE_URL');
export const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

// 크롤링 대상 채널 키워드 (이 키워드가 포함된 채널만 수집)
export const CRAWL_CHANNEL_KEYWORDS = [
  'crypto', 'memecoin', 'meme', 'trading', 'signals', 'degen',
  'alpha', 'pump', 'gem', 'coin', 'token', 'defi', 'solana',
  'general', 'chat', 'discussion',
];

// 메시지 수집 제외 채널
export const IGNORE_CHANNEL_KEYWORDS = [
  'bot-commands', 'rules', 'announcements', 'welcome', 'intro',
  'roles', 'verify', 'mod', 'admin', 'log', 'nsfw',
];

export const CRAWL_BATCH_SIZE = 50;
export const CRAWL_INTERVAL_MS = 15 * 60 * 1000; // 15분
export const MIN_MESSAGE_LENGTH = 20;

// 시그널 알림 임계값
export const ALERT_SCORE_THRESHOLD = 60;
export const ALERT_VELOCITY_THRESHOLD = 2.0;

// Heat 라벨
export const HEAT_LABELS: Record<string, { emoji: string; label: string; color: number }> = {
  extremely_hot: { emoji: '🔥', label: 'Extremely Hot', color: 0xff1744 },
  hot: { emoji: '🟠', label: 'Hot', color: 0xff6d00 },
  warm: { emoji: '🟡', label: 'Warm', color: 0xffd600 },
  cool: { emoji: '🔵', label: 'Cool', color: 0x2979ff },
  cold: { emoji: '❄️', label: 'Cold', color: 0x90caf9 },
};
