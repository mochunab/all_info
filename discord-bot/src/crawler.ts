import type { Message, TextChannel } from 'discord.js';
import { upsertDiscordMessages, insertMentions } from './db.js';
import { extractCoinMentions } from './coin-extractor.js';
import {
  CRAWL_CHANNEL_KEYWORDS,
  IGNORE_CHANNEL_KEYWORDS,
  MIN_MESSAGE_LENGTH,
} from './config.js';

function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uD800-\uDFFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/\0/g, '');
}

function shouldCrawlChannel(channelName: string): boolean {
  const lower = channelName.toLowerCase();
  if (IGNORE_CHANNEL_KEYWORDS.some((kw) => lower.includes(kw))) return false;
  return CRAWL_CHANNEL_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isRelevantChannel(channelName: string): boolean {
  return shouldCrawlChannel(channelName);
}

export async function processMessage(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.content || message.content.length < MIN_MESSAGE_LENGTH) return;

  const channel = message.channel as TextChannel;
  if (!shouldCrawlChannel(channel.name)) return;

  const text = sanitizeText(message.content);
  const title = text.slice(0, 200);
  const body = text.length > 200 ? text.slice(0, 2000) : null;

  const guildName = message.guild?.name || 'unknown';
  const row = {
    source: 'discord' as const,
    source_id: `discord_${message.id}`,
    channel: sanitizeText(`${guildName}/#${channel.name}`),
    title: sanitizeText(title),
    body: body ? sanitizeText(body) : null,
    author: sanitizeText(message.author.username),
    permalink: `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`,
    upvotes: 0,
    upvote_ratio: 0,
    num_comments: 0,
    num_awards: 0,
    score: 0,
    flair: null,
    posted_at: message.createdAt.toISOString(),
    crawled_at: new Date().toISOString(),
  };

  try {
    const { upserted, error } = await upsertDiscordMessages([row]);
    if (error) {
      console.error(`❌ Discord upsert: ${error.message}`);
      return;
    }

    if (upserted.length === 0) return;

    const dbId = upserted[0].id;
    const mentions = extractCoinMentions(title, body);

    if (mentions.length > 0) {
      const mentionRows = mentions.map((m) => ({
        post_id: dbId,
        coin_symbol: m.symbol,
        coin_name: m.name,
        mention_count: m.count,
        context: m.context ? sanitizeText(m.context) : null,
      }));
      await insertMentions(mentionRows);
    }
  } catch (err) {
    console.error(`❌ Discord message processing:`, err);
  }
}
