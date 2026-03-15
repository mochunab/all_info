// 밈코인 예측기 TypeScript 타입

// ── DB Row Types ──

export type CryptoSource = 'reddit' | 'telegram';

export type CryptoPost = {
  id: string;
  source: CryptoSource;
  source_id: string;
  channel: string;
  title: string;
  body: string | null;
  author: string | null;
  permalink: string | null;
  upvotes: number;
  upvote_ratio: number;
  num_comments: number;
  num_awards: number;
  score: number;
  flair: string | null;
  posted_at: string;
  crawled_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CryptoMention = {
  id: string;
  post_id: string;
  coin_symbol: string;
  coin_name: string | null;
  mention_count: number;
  context: string | null;
  created_at: string;
};

export type CryptoSentiment = {
  id: string;
  post_id: string;
  sentiment_score: number;
  sentiment_label: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  key_phrases: string[];
  fomo_score: number;
  fud_score: number;
  mentioned_coins: string[];
  reasoning: string | null;
  model_used: string | null;
  created_at: string;
};

export type CryptoSignal = {
  id: string;
  coin_symbol: string;
  time_window: '1h' | '6h' | '24h' | '7d';
  mention_count: number;
  mention_velocity: number;
  avg_sentiment: number;
  sentiment_trend: number;
  weighted_score: number;
  engagement_score: number;
  signal_label: SignalLabel;
  top_posts: TopPostSummary[];
  computed_at: string;
  created_at: string;
};

export type CryptoEntity = {
  id: string;
  entity_type: EntityType;
  name: string;
  symbol: string | null;
  metadata: Record<string, unknown>;
  mention_count: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type CryptoRelation = {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: RelationType;
  weight: number;
  context: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ── Enums ──

export type SignalLabel = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
export type EntityType = 'coin' | 'influencer' | 'event' | 'narrative';
export type RelationType = 'mentions' | 'recommends' | 'correlates_with' | 'part_of';
export type TimeWindow = '1h' | '6h' | '24h' | '7d';

// ── Reddit API Types ──

export type RedditPost = {
  id: string;
  name: string;
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  permalink: string;
  ups: number;
  upvote_ratio: number;
  num_comments: number;
  total_awards_received: number;
  score: number;
  link_flair_text: string | null;
  created_utc: number;
  is_self: boolean;
};

export type RedditListingResponse = {
  kind: string;
  data: {
    after: string | null;
    children: { kind: string; data: RedditPost }[];
  };
};

// ── Telegram API Types ──

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; title?: string; type: string };
  from?: { id: number; username?: string; first_name?: string };
  text?: string;
  caption?: string;
  date: number;
  reply_to_message?: TelegramMessage;
  forward_from_chat?: { id: number; title?: string };
  views?: number;
  forwards?: number;
};

export type TelegramUpdate = {
  update_id: number;
  channel_post?: TelegramMessage;
  message?: TelegramMessage;
};

// ── Sentiment Analysis Types ──

export type CryptoSentimentResult = {
  sentiment_score: number;
  sentiment_label: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  mentioned_coins: string[];
  key_phrases: string[];
  fomo_score: number;
  fud_score: number;
  reasoning: string;
};

// ── Signal Types ──

export type TopPostSummary = {
  source_id: string;
  title: string;
  score: number;
  sentiment_score: number;
  channel: string;
};

export type SignalComputeResult = {
  coin_symbol: string;
  time_window: TimeWindow;
  mention_count: number;
  mention_velocity: number;
  avg_sentiment: number;
  sentiment_trend: number;
  weighted_score: number;
  engagement_score: number;
  signal_label: SignalLabel;
  top_posts: TopPostSummary[];
};

// ── API Response Types ──

export type CryptoPostsResponse = {
  posts: CryptoPost[];
  total: number;
  page: number;
  limit: number;
};

export type CryptoSignalsResponse = {
  signals: CryptoSignal[];
  computed_at: string;
};

export type CryptoCoinResponse = {
  entity: CryptoEntity;
  signals: CryptoSignal[];
  relations: (CryptoRelation & {
    related_entity: CryptoEntity;
  })[];
  recent_posts: CryptoPost[];
};

// ── Config Types ──

export type SubredditConfig = {
  name: string;
  weight: number;
  minScore: number;
};

export type TelegramChannelConfig = {
  username: string;
  weight: number;
  language: 'en' | 'ko';
};

export type CoinEntry = {
  symbol: string;
  name: string;
  aliases: string[];
};

// ── Crawl Result ──

export type CryptoCrawlResult = {
  source: CryptoSource;
  channel: string;
  postsFound: number;
  postsNew: number;
  mentionsExtracted: number;
  errors: string[];
};
