import type { SupabaseClient } from '@supabase/supabase-js';
import type { CryptoCrawlResult } from '@/types/crypto';
import { extractCoinMentionsFromDB } from '@/lib/crypto/coin-extractor';
import {
  FOURCHAN_API_BASE,
  FOURCHAN_BOARD,
  FOURCHAN_RATE_LIMIT_MS,
  FOURCHAN_MAX_THREADS,
  FOURCHAN_MIN_REPLIES,
  POST_BODY_TRUNCATE_LENGTH,
} from '@/lib/crypto/config';
import { COIN_LIST } from '@/lib/crypto/config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 크립토 관련 키워드 (쓰레드 필터링용)
const CRYPTO_KEYWORDS = new Set([
  ...COIN_LIST.map((c) => c.symbol.toLowerCase()),
  ...COIN_LIST.flatMap((c) => c.aliases),
  'crypto', 'cryptocurrency', 'blockchain', 'defi', 'nft', 'token',
  'memecoin', 'meme coin', 'shitcoin', 'altcoin', 'pump', 'dump',
  'moon', 'hodl', 'wagmi', 'ngmi', 'degen', 'rug', 'rugpull',
  'airdrop', 'staking', 'yield', 'swap', 'dex', 'cex',
  'binance', 'coinbase', 'kraken', 'uniswap', 'raydium', 'jupiter',
  'solana', 'ethereum', 'bitcoin', 'base chain', 'arbitrum',
  'pump.fun', 'pumpfun', 'bonding curve', 'market cap',
]);

type CatalogThread = {
  no: number;
  sub?: string;
  com?: string;
  time: number;
  replies: number;
  images: number;
  last_modified: number;
};

type ThreadPost = {
  no: number;
  com?: string;
  name?: string;
  time: number;
  replies?: number;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<wbr\s*\/?>/gi, '')
    .replace(/<a[^>]*class="quotelink"[^>]*>[^<]*<\/a>/gi, '')
    .replace(/<s>[^<]*<\/s>/gi, '[spoiler]')
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&[^;]+;/g, ' ')
    .trim();
}

function sanitizeText(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xDC00 && next <= 0xDFFF) {
        result += text[i] + text[i + 1];
        i++;
      }
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      // orphan low surrogate
    } else if (code <= 0x08 || code === 0x0B || code === 0x0C || (code >= 0x0E && code <= 0x1F)) {
      // control char
    } else {
      result += text[i];
    }
  }
  return result;
}

function safeTruncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  let end = maxLen;
  const code = text.charCodeAt(end - 1);
  if (code >= 0xD800 && code <= 0xDBFF) end--;
  return text.slice(0, end);
}

function isCryptoRelated(text: string): boolean {
  const lower = text.toLowerCase();
  // $TICKER 패턴
  if (/\$[A-Z]{2,10}\b/.test(text)) return true;
  for (const kw of CRYPTO_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

async function fetchCatalog(): Promise<CatalogThread[]> {
  const res = await fetch(`${FOURCHAN_API_BASE}/${FOURCHAN_BOARD}/catalog.json`, {
    headers: { 'User-Agent': 'InsightHub/1.0 (Crypto Monitor)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`4chan catalog: ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages: any[] = await res.json();
  const threads: CatalogThread[] = [];
  for (const page of pages) {
    for (const t of page.threads || []) {
      threads.push(t);
    }
  }
  return threads;
}

async function fetchThread(threadNo: number): Promise<ThreadPost[]> {
  const res = await fetch(`${FOURCHAN_API_BASE}/${FOURCHAN_BOARD}/thread/${threadNo}.json`, {
    headers: { 'User-Agent': 'InsightHub/1.0 (Crypto Monitor)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    if (res.status === 404) return []; // archived
    throw new Error(`4chan thread ${threadNo}: ${res.status}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  return data.posts || [];
}

function postToRow(
  threadNo: number,
  post: ThreadPost,
  isOp: boolean,
  opSubject: string | null
) {
  const rawText = stripHtml(post.com || '');
  if (!rawText || rawText.length < 10) return null;

  const cleanText = sanitizeText(rawText);
  const title = safeTruncate(
    isOp && opSubject ? sanitizeText(stripHtml(opSubject)) : cleanText,
    200
  );
  const body = cleanText.length > 200 ? safeTruncate(cleanText, POST_BODY_TRUNCATE_LENGTH) : null;

  return {
    source: '4chan' as const,
    source_id: `4chan_biz_${post.no}`,
    channel: `/biz/${threadNo}`,
    title,
    body,
    author: sanitizeText(post.name || 'Anonymous'),
    permalink: `https://boards.4chan.org/biz/thread/${threadNo}#p${post.no}`,
    upvotes: 0,
    upvote_ratio: 0,
    num_comments: isOp ? (post.replies || 0) : 0,
    num_awards: 0,
    score: isOp ? (post.replies || 0) : 0,
    flair: null,
    posted_at: new Date(post.time * 1000).toISOString(),
    crawled_at: new Date().toISOString(),
    metadata: { board: FOURCHAN_BOARD, thread_no: threadNo, is_op: isOp },
  };
}

export async function crawlFourchan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  timeBudgetMs: number = 120_000
): Promise<{ results: CryptoCrawlResult[]; completed: boolean }> {
  const callStart = Date.now();
  const result: CryptoCrawlResult = {
    source: '4chan',
    channel: '/biz/',
    postsFound: 0,
    postsNew: 0,
    mentionsExtracted: 0,
    errors: [],
  };

  try {
    const catalog = await fetchCatalog();
    console.log(`📋 [4chan] /biz/ 카탈로그: ${catalog.length}개 쓰레드`);

    // 크립토 관련 + 최소 댓글 수 필터
    const cryptoThreads = catalog
      .filter((t) => {
        const text = `${t.sub || ''} ${t.com || ''}`;
        const plain = stripHtml(text);
        return isCryptoRelated(plain) && t.replies >= FOURCHAN_MIN_REPLIES;
      })
      .sort((a, b) => b.last_modified - a.last_modified)
      .slice(0, FOURCHAN_MAX_THREADS);

    console.log(`🔍 [4chan] 크립토 쓰레드: ${cryptoThreads.length}개 (댓글 ${FOURCHAN_MIN_REPLIES}개 이상)`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRows: any[] = [];

    for (const thread of cryptoThreads) {
      if ((Date.now() - callStart) > timeBudgetMs) {
        console.log(`⏰ [4chan] 시간 제한 도달`);
        break;
      }

      try {
        await sleep(FOURCHAN_RATE_LIMIT_MS);
        const posts = await fetchThread(thread.no);

        for (let i = 0; i < posts.length; i++) {
          const row = postToRow(thread.no, posts[i], i === 0, thread.sub || null);
          if (row) {
            // OP가 아닌 댓글도 크립토 관련인지 체크
            if (i === 0 || isCryptoRelated(stripHtml(posts[i].com || ''))) {
              allRows.push(row);
            }
          }
        }
      } catch (e) {
        result.errors.push(`thread ${thread.no}: ${(e as Error).message}`);
      }
    }

    result.postsFound = allRows.length;
    if (allRows.length === 0) {
      return { results: [result], completed: true };
    }

    // 배치 upsert (500개씩)
    const BATCH_SIZE = 500;
    const allUpserted: { id: string; source_id: string }[] = [];

    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      const batch = allRows.slice(i, i + BATCH_SIZE);
      const { data: upserted, error } = await supabase
        .from('crypto_posts')
        .upsert(batch, { onConflict: 'source_id', ignoreDuplicates: false })
        .select('id, source_id');

      if (error) {
        result.errors.push(`upsert batch ${i}: ${error.message}`);
      } else {
        allUpserted.push(...(upserted || []));
      }
    }

    result.postsNew = allUpserted.length;

    // 멘션 추출
    const sourceIdToDbId = new Map(allUpserted.map((r) => [r.source_id, r.id]));
    const mentionRows: {
      post_id: string;
      coin_symbol: string;
      coin_name: string | null;
      mention_count: number;
      context: string | null;
    }[] = [];

    for (const row of allRows) {
      const dbId = sourceIdToDbId.get(row.source_id);
      if (!dbId) continue;

      const mentions = await extractCoinMentionsFromDB(row.title, row.body, supabase, { strictMode: true });
      for (const m of mentions) {
        mentionRows.push({
          post_id: dbId,
          coin_symbol: m.symbol,
          coin_name: m.name,
          mention_count: m.count,
          context: m.context ? sanitizeText(m.context) : null,
        });
      }
    }

    if (mentionRows.length > 0) {
      const postIds = [...new Set(mentionRows.map((m) => m.post_id))];

      // 배치 삭제
      for (let i = 0; i < postIds.length; i += 500) {
        await supabase.from('crypto_mentions').delete().in('post_id', postIds.slice(i, i + 500));
      }

      // 배치 삽입
      for (let i = 0; i < mentionRows.length; i += 500) {
        const { error } = await supabase.from('crypto_mentions').insert(mentionRows.slice(i, i + 500));
        if (error) result.errors.push(`mention batch ${i}: ${error.message}`);
      }

      result.mentionsExtracted = mentionRows.length;
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { results: [result], completed: true };
}
