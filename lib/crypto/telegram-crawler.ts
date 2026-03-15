import type { SupabaseClient } from '@supabase/supabase-js';
import type { CryptoCrawlResult } from '@/types/crypto';
import { extractCoinMentions } from '@/lib/crypto/coin-extractor';
import {
  TELEGRAM_CHANNELS,
  TELEGRAM_RATE_LIMIT_MS,
  POST_BODY_TRUNCATE_LENGTH,
} from '@/lib/crypto/config';
import * as cheerio from 'cheerio';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TelegramWebPost = {
  postId: string;
  channelUsername: string;
  messageId: number;
  text: string;
  views: number;
  datetime: string;
};

function parseViewCount(viewStr: string): number {
  const s = viewStr.trim().toUpperCase();
  if (s.endsWith('K')) return Math.round(parseFloat(s) * 1000);
  if (s.endsWith('M')) return Math.round(parseFloat(s) * 1_000_000);
  return parseInt(s, 10) || 0;
}

async function fetchChannelPage(channelUsername: string, before?: number): Promise<TelegramWebPost[]> {
  const url = before
    ? `https://t.me/s/${channelUsername}?before=${before}`
    : `https://t.me/s/${channelUsername}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'InsightHub/1.0 (Crypto Monitor)',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Telegram web preview error: ${response.status} for t/${channelUsername}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const posts: TelegramWebPost[] = [];

  $('.tgme_widget_message').each((_, el) => {
    const $msg = $(el);
    const dataPost = $msg.attr('data-post');
    if (!dataPost) return;

    const [channel, msgIdStr] = dataPost.split('/');
    const messageId = parseInt(msgIdStr, 10);
    if (!messageId) return;

    const textEl = $msg.find('.tgme_widget_message_text');
    const text = textEl.text().trim();
    if (!text) return;

    const viewsEl = $msg.find('.tgme_widget_message_views');
    const views = viewsEl.length ? parseViewCount(viewsEl.text()) : 0;

    const timeEl = $msg.find('time[datetime]');
    const datetime = timeEl.attr('datetime') || new Date().toISOString();

    posts.push({
      postId: dataPost,
      channelUsername: channel,
      messageId,
      text,
      views,
      datetime,
    });
  });

  return posts;
}

function sanitizeText(text: string): string {
  // null bytes 및 제어 문자 제거 (JSON 파싱 에러 방지)
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function telegramWebPostToRow(post: TelegramWebPost, channelUsername: string) {
  const cleanText = sanitizeText(post.text);
  const title = cleanText.slice(0, 200);
  const body = cleanText.length > 200 ? cleanText.slice(0, POST_BODY_TRUNCATE_LENGTH) : null;
  const score = post.views;

  return {
    source: 'telegram' as const,
    source_id: `tg_${post.postId.replace('/', '_')}`,
    channel: channelUsername,
    title,
    body,
    author: channelUsername,
    permalink: `https://t.me/${post.postId}`,
    upvotes: post.views,
    upvote_ratio: 0,
    num_comments: 0,
    num_awards: 0,
    score,
    flair: null,
    posted_at: new Date(post.datetime).toISOString(),
    crawled_at: new Date().toISOString(),
    metadata: { views: post.views },
  };
}

export async function crawlTelegramChannel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  channelUsername: string
): Promise<CryptoCrawlResult> {
  const result: CryptoCrawlResult = {
    source: 'telegram',
    channel: channelUsername,
    postsFound: 0,
    postsNew: 0,
    mentionsExtracted: 0,
    errors: [],
  };

  try {
    const posts = await fetchChannelPage(channelUsername);
    result.postsFound = posts.length;
    if (posts.length === 0) return result;

    const rows = posts.map((p) => telegramWebPostToRow(p, channelUsername));

    const { data: upserted, error: upsertError } = await supabase
      .from('crypto_posts')
      .upsert(rows, { onConflict: 'source_id', ignoreDuplicates: false })
      .select('id, source_id');

    if (upsertError) {
      result.errors.push(`upsert error: ${upsertError.message}`);
      return result;
    }

    const upsertedPosts = upserted || [];
    result.postsNew = upsertedPosts.length;

    const sourceIdToDbId = new Map<string, string>();
    for (const row of upsertedPosts) {
      sourceIdToDbId.set(row.source_id, row.id);
    }

    const mentionRows: {
      post_id: string;
      coin_symbol: string;
      coin_name: string | null;
      mention_count: number;
      context: string | null;
    }[] = [];

    for (const post of posts) {
      const sourceId = `tg_${post.postId.replace('/', '_')}`;
      const dbId = sourceIdToDbId.get(sourceId);
      if (!dbId) continue;

      const title = post.text.slice(0, 200);
      const body = post.text.length > 200 ? post.text : null;
      const mentions = extractCoinMentions(title, body);

      for (const m of mentions) {
        mentionRows.push({
          post_id: dbId,
          coin_symbol: m.symbol,
          coin_name: m.name,
          mention_count: m.count,
          context: m.context,
        });
      }
    }

    if (mentionRows.length > 0) {
      const postIds = [...new Set(mentionRows.map((m) => m.post_id))];
      await supabase
        .from('crypto_mentions')
        .delete()
        .in('post_id', postIds);

      const { error: mentionError } = await supabase
        .from('crypto_mentions')
        .insert(mentionRows);

      if (mentionError) {
        result.errors.push(`mention insert error: ${mentionError.message}`);
      } else {
        result.mentionsExtracted = mentionRows.length;
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

export async function crawlAllTelegramChannels(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<CryptoCrawlResult[]> {
  const results: CryptoCrawlResult[] = [];

  for (const config of TELEGRAM_CHANNELS) {
    console.log(`\n📌 [크립토] t/${config.username} 크롤링 시작`);
    const result = await crawlTelegramChannel(supabase, config.username);

    if (result.errors.length > 0) {
      console.error(`❌ [크립토] t/${config.username} 오류: ${result.errors.join('; ')}`);
    } else {
      console.log(`✅ [크립토] t/${config.username} — ${result.postsFound}개 발견, ${result.postsNew}개 저장, ${result.mentionsExtracted}개 멘션`);
    }

    results.push(result);
    await sleep(TELEGRAM_RATE_LIMIT_MS);
  }

  return results;
}
