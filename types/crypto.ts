// 밈코인 예측기 TypeScript 타입

// ── DB Row Types ──

export type CryptoSource = 'reddit' | 'telegram' | 'threads' | 'twitter';

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

export type CryptoCoin = {
  id: string;
  coingecko_id: string;
  symbol: string;
  name: string;
  image_url: string | null;
  market_cap_rank: number | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CryptoPrice = {
  id: string;
  coingecko_id: string;
  price_usd: number;
  market_cap: number | null;
  volume_24h: number | null;
  price_change_24h: number | null;
  price_change_pct_24h: number | null;
  circulating_supply: number | null;
  fetched_at: string;
  created_at: string;
};

// ── Enums ──

export type SignalLabel = 'extremely_hot' | 'hot' | 'warm' | 'cool' | 'cold';
export type EntityType = 'coin' | 'influencer' | 'event' | 'narrative';
export type RelationType = 'mentions' | 'recommends' | 'correlates_with' | 'part_of' | 'impacts';
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
  subreddit_subscribers?: number;
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

// ── Threads API Types ──

export type ThreadsSearchPost = {
  id: string;
  text: string;
  media_type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  permalink: string;
  timestamp: string;
  username: string;
};

export type ThreadsSearchResponse = {
  data: ThreadsSearchPost[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
};

export type ThreadsSearchKeyword = {
  keyword: string;
  weight: number;
};

// ── Twitter/X (Apify) Types ──

export type TwitterSearchKeyword = {
  query: string;
  weight: number;
};

export type ApifyTweet = {
  id: string;
  text: string;
  full_text: string;
  created_at: string;
  lang: string;
  username: string;
  user_name: string;
  user_id: string;
  user_followers_count: number;
  user_verified: boolean;
  user_is_blue_verified: boolean;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  bookmark_count: number;
  is_retweet: boolean;
  is_quote_status: boolean;
  hashtags: string[];
  user_mentions: string[];
  conversation_id: string;
};

// ── Sentiment Analysis Types ──

export type CryptoSentimentEvent = {
  name: string;
  coins: string[];
  impact: 'positive' | 'negative' | 'neutral';
};

export type CryptoSentimentResult = {
  sentiment_score: number;
  sentiment_label: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  mentioned_coins: string[];
  key_phrases: string[];
  fomo_score: number;
  fud_score: number;
  reasoning: string;
  narratives?: string[];
  events?: CryptoSentimentEvent[];
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

// ── Trending Explain Types ──

export type TrendingExplainResponse = {
  coin_symbol: string;

  score_breakdown: {
    velocity: { normalized: number; weight: 0.25 };
    sentiment: { normalized: number; weight: 0.30 };
    engagement: { normalized: number; weight: 0.20 };
    fomo: { normalized: number; weight: 0.10 };
    mention_confidence: number;
    final_score: number;
  };

  post_sentiments: {
    title: string;
    channel: string;
    source: CryptoSource;
    permalink: string | null;
    score: number;
    sentiment_label: string;
    fomo_score: number;
    fud_score: number;
    reasoning: string | null;
    key_phrases: string[];
  }[];

  source_breakdown: { source: string; count: number; avg_sentiment: number }[];

  top_phrases: { phrase: string; count: number }[];

  narratives: { name: string }[];
  events: { name: string }[];

  price: {
    price_usd: number;
    price_change_pct_24h: number | null;
    volume_24h: number | null;
  } | null;
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

export type CryptoPricesResponse = {
  prices: (CryptoPrice & { coin: CryptoCoin })[];
  fetched_at: string | null;
};

// ── Battle Types ──

export type BattlePlayer = 'monkey' | 'robot';

export type BattlePosition = {
  id: string;
  player: BattlePlayer;
  coin_symbol: string;
  entry_price: number;
  initial_size: number;
  remaining_size: number;
  stop_loss_price: number | null;
  take_profit_stage: number;
  status: 'open' | 'closed';
  close_reason: string | null;
  realized_pnl: number;
  signal_snapshot: BattleSignalSnapshot | null;
  hold_until: string | null;
  opened_at: string;
  closed_at: string | null;
};

export type BattleSignalSnapshot = {
  signal_label: string;
  weighted_score: number;
  avg_sentiment: number;
  mention_velocity: number;
  fomo_avg: number;
  confidence: number;
};

export type BattleCloseReason =
  | 'stop_loss'
  | 'take_profit_1'
  | 'take_profit_2'
  | 'signal_reversal'
  | 'sentiment_drop'
  | 'velocity_dead'
  | 'hold_expired';

export type BattleTrade = {
  id: string;
  trade_date: string;
  player: BattlePlayer;
  coin_symbol: string;
  action: 'buy' | 'sell';
  entry_price: number;
  trade_size: number;
  price_at_close: number | null;
  pnl: number | null;
  signal_label: string | null;
  weighted_score: number | null;
  position_id: string | null;
  reason: string | null;
  traded_at: string | null;
};

export type BattlePortfolio = {
  id: string;
  snapshot_date: string;
  player: BattlePlayer;
  portfolio_value: number;
  total_trades: number;
  win_count: number;
  cash_balance: number | null;
  open_positions: number | null;
};

export type BattleResponse = {
  portfolio: {
    monkey: { current: number; change_pct: number; cash: number; openPositions: number };
    robot: { current: number; change_pct: number; cash: number; openPositions: number };
  };
  history: {
    dates: string[];
    monkey: number[];
    robot: number[];
  };
  recentTrades: {
    monkey: BattleTrade[];
    robot: BattleTrade[];
  };
  openPositions: {
    monkey: BattlePosition[];
    robot: BattlePosition[];
  };
  stats: {
    totalTrades: number;
    monkeyWins: number;
    robotWins: number;
    monkeyWinRate: number;
    robotWinRate: number;
  };
};

// ── Backtest Types ──

export type BacktestResult = {
  id: string;
  coin_symbol: string;
  time_window: TimeWindow;
  signal_label: SignalLabel;
  weighted_score: number;
  signal_at: string;
  price_at_signal: number;
  price_after: number | null;
  price_change_pct: number | null;
  lookup_window: string;
  hit: boolean | null;
  evaluated_at: string | null;
  created_at: string;
};

export type BacktestSummary = {
  signal_label: string;
  total: number;
  wins: number;
  win_rate: number;
  avg_return: number;
};

export type BacktestCoinSummary = {
  coin_symbol: string;
  total: number;
  wins: number;
  win_rate: number;
  avg_return: number;
};

export type BacktestResponse = {
  summary: BacktestSummary[];
  coinSummary: BacktestCoinSummary[];
  totalEvaluated: number;
  lookupWindow: string;
  recentResults: {
    coin_symbol: string;
    signal_label: string;
    weighted_score: number;
    price_change_pct: number;
    hit: boolean;
    signal_at: string;
  }[];
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
