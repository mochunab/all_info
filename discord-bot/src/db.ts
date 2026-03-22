import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Signal Queries ──

type Signal = {
  coin_symbol: string;
  weighted_score: number;
  signal_label: string;
  signal_type: string;
  mention_count: number;
  mention_velocity: number;
  avg_sentiment: number;
  source_count: number;
  detected_events: string[];
  contrarian_warning: string | null;
};

export async function getTopSignals(
  timeWindow: string = '24h',
  signalType: string = 'fomo',
  limit: number = 5
): Promise<Signal[]> {
  const { data, error } = await supabase
    .from('crypto_signals')
    .select('coin_symbol, weighted_score, signal_label, signal_type, mention_count, mention_velocity, avg_sentiment, source_count, detected_events, contrarian_warning')
    .eq('time_window', timeWindow)
    .eq('signal_type', signalType)
    .order('weighted_score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getCoinSignal(
  coinSymbol: string,
  timeWindow: string = '24h'
): Promise<{ fomo: Signal | null; fud: Signal | null }> {
  const { data, error } = await supabase
    .from('crypto_signals')
    .select('coin_symbol, weighted_score, signal_label, signal_type, mention_count, mention_velocity, avg_sentiment, source_count, detected_events, contrarian_warning, sentiment_skew, z_score, event_modifier')
    .eq('coin_symbol', coinSymbol.toUpperCase())
    .eq('time_window', timeWindow);

  if (error) throw error;

  const fomo = data?.find((s) => s.signal_type === 'fomo') || null;
  const fud = data?.find((s) => s.signal_type === 'fud') || null;
  return { fomo, fud };
}

export async function getBacktestSummary(): Promise<{ signal_label: string; signal_type: string; total: number; hit: number; hit_rate: number; avg_return_pct: number }[]> {
  const { data, error } = await supabase
    .from('crypto_backtest_summary')
    .select('*');

  if (error) throw error;
  return data || [];
}

// ── Discord Message Storage ──

export async function upsertDiscordMessages(rows: {
  source: 'discord';
  source_id: string;
  channel: string;
  title: string;
  body: string | null;
  author: string;
  permalink: string;
  upvotes: number;
  upvote_ratio: number;
  num_comments: number;
  num_awards: number;
  score: number;
  flair: string | null;
  posted_at: string;
  crawled_at: string;
}[]) {
  if (rows.length === 0) return { upserted: [], error: null };

  const { data, error } = await supabase
    .from('crypto_posts')
    .upsert(rows, { onConflict: 'source_id', ignoreDuplicates: false })
    .select('id, source_id');

  return { upserted: data || [], error };
}

export async function insertMentions(mentionRows: {
  post_id: string;
  coin_symbol: string;
  coin_name: string | null;
  mention_count: number;
  context: string | null;
}[]) {
  if (mentionRows.length === 0) return;

  const postIds = [...new Set(mentionRows.map((m) => m.post_id))];
  await supabase.from('crypto_mentions').delete().in('post_id', postIds);
  await supabase.from('crypto_mentions').insert(mentionRows);
}

// ── Alert Channel Registry ──

export async function getAlertChannels(): Promise<{ guild_id: string; channel_id: string }[]> {
  const { data, error } = await supabase
    .from('discord_alert_channels')
    .select('guild_id, channel_id');

  if (error) {
    console.warn('discord_alert_channels not found, skipping:', error.message);
    return [];
  }
  return data || [];
}

export async function setAlertChannel(guildId: string, channelId: string) {
  await supabase
    .from('discord_alert_channels')
    .upsert({ guild_id: guildId, channel_id: channelId }, { onConflict: 'guild_id' });
}

export async function removeAlertChannel(guildId: string) {
  await supabase
    .from('discord_alert_channels')
    .delete()
    .eq('guild_id', guildId);
}
