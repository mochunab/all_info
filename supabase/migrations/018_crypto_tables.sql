-- 밈코인 예측기 테이블 (Phase 1~3)

-- crypto_posts: Reddit 게시물 + 참여 지표
CREATE TABLE IF NOT EXISTS crypto_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reddit_id text NOT NULL,
  subreddit text NOT NULL,
  title text NOT NULL,
  body text,
  author text,
  permalink text,
  upvotes integer DEFAULT 0,
  upvote_ratio numeric(3,2) DEFAULT 0,
  num_comments integer DEFAULT 0,
  num_awards integer DEFAULT 0,
  score integer DEFAULT 0,
  flair text,
  posted_at timestamptz NOT NULL,
  crawled_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT crypto_posts_reddit_id_unique UNIQUE (reddit_id)
);

CREATE INDEX IF NOT EXISTS idx_crypto_posts_subreddit ON crypto_posts (subreddit);
CREATE INDEX IF NOT EXISTS idx_crypto_posts_posted_at ON crypto_posts (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_posts_score ON crypto_posts (score DESC);

-- crypto_mentions: 코인 언급 추출
CREATE TABLE IF NOT EXISTS crypto_mentions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES crypto_posts(id) ON DELETE CASCADE,
  coin_symbol text NOT NULL,
  coin_name text,
  mention_count integer DEFAULT 1,
  context text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crypto_mentions_coin_symbol ON crypto_mentions (coin_symbol);
CREATE INDEX IF NOT EXISTS idx_crypto_mentions_post_id ON crypto_mentions (post_id);
CREATE INDEX IF NOT EXISTS idx_crypto_mentions_created_at ON crypto_mentions (created_at DESC);

-- crypto_sentiments: LLM 센티먼트 분석 (Phase 2)
CREATE TABLE IF NOT EXISTS crypto_sentiments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES crypto_posts(id) ON DELETE CASCADE,
  sentiment_score numeric(4,3) NOT NULL CHECK (sentiment_score BETWEEN -1 AND 1),
  sentiment_label text NOT NULL CHECK (sentiment_label IN ('bullish', 'bearish', 'neutral')),
  confidence numeric(4,3) DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  key_phrases text[] DEFAULT '{}',
  fomo_score numeric(4,3) DEFAULT 0 CHECK (fomo_score BETWEEN 0 AND 1),
  fud_score numeric(4,3) DEFAULT 0 CHECK (fud_score BETWEEN 0 AND 1),
  mentioned_coins text[] DEFAULT '{}',
  reasoning text,
  model_used text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT crypto_sentiments_post_unique UNIQUE (post_id)
);

-- crypto_signals: 코인별 집계 시그널 (Phase 2)
CREATE TABLE IF NOT EXISTS crypto_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coin_symbol text NOT NULL,
  time_window text NOT NULL CHECK (time_window IN ('1h', '6h', '24h', '7d')),
  mention_count integer DEFAULT 0,
  mention_velocity numeric(8,4) DEFAULT 0,
  avg_sentiment numeric(4,3) DEFAULT 0,
  sentiment_trend numeric(4,3) DEFAULT 0,
  weighted_score numeric(5,2) DEFAULT 0 CHECK (weighted_score BETWEEN 0 AND 100),
  engagement_score numeric(10,2) DEFAULT 0,
  signal_label text NOT NULL CHECK (signal_label IN ('strong_buy', 'buy', 'neutral', 'sell', 'strong_sell')),
  top_posts jsonb DEFAULT '[]'::jsonb,
  computed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT crypto_signals_unique UNIQUE (coin_symbol, time_window, computed_at)
);

CREATE INDEX IF NOT EXISTS idx_crypto_signals_coin ON crypto_signals (coin_symbol);
CREATE INDEX IF NOT EXISTS idx_crypto_signals_computed_at ON crypto_signals (computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_signals_score ON crypto_signals (weighted_score DESC);

-- crypto_entities: 지식그래프 노드 (Phase 3)
CREATE TABLE IF NOT EXISTS crypto_entities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('coin', 'influencer', 'event', 'narrative')),
  name text NOT NULL,
  symbol text,
  metadata jsonb DEFAULT '{}'::jsonb,
  mention_count integer DEFAULT 0,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT crypto_entities_unique UNIQUE (entity_type, name)
);

CREATE INDEX IF NOT EXISTS idx_crypto_entities_type ON crypto_entities (entity_type);
CREATE INDEX IF NOT EXISTS idx_crypto_entities_symbol ON crypto_entities (symbol);

-- crypto_relations: 지식그래프 엣지 (Phase 3)
CREATE TABLE IF NOT EXISTS crypto_relations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_entity_id uuid NOT NULL REFERENCES crypto_entities(id) ON DELETE CASCADE,
  target_entity_id uuid NOT NULL REFERENCES crypto_entities(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('mentions', 'recommends', 'correlates_with', 'part_of')),
  weight numeric(5,2) DEFAULT 1.0,
  context text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crypto_relations_source ON crypto_relations (source_entity_id);
CREATE INDEX IF NOT EXISTS idx_crypto_relations_target ON crypto_relations (target_entity_id);
CREATE INDEX IF NOT EXISTS idx_crypto_relations_type ON crypto_relations (relation_type);

-- RLS
ALTER TABLE crypto_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_sentiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crypto_posts_read" ON crypto_posts FOR SELECT USING (true);
CREATE POLICY "crypto_mentions_read" ON crypto_mentions FOR SELECT USING (true);
CREATE POLICY "crypto_sentiments_read" ON crypto_sentiments FOR SELECT USING (true);
CREATE POLICY "crypto_signals_read" ON crypto_signals FOR SELECT USING (true);
CREATE POLICY "crypto_entities_read" ON crypto_entities FOR SELECT USING (true);
CREATE POLICY "crypto_relations_read" ON crypto_relations FOR SELECT USING (true);

-- 쓰기: service_role만 (크롤러/배치에서 사용)
CREATE POLICY "crypto_posts_insert" ON crypto_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "crypto_posts_update" ON crypto_posts FOR UPDATE USING (true);
CREATE POLICY "crypto_mentions_insert" ON crypto_mentions FOR INSERT WITH CHECK (true);
CREATE POLICY "crypto_sentiments_insert" ON crypto_sentiments FOR INSERT WITH CHECK (true);
CREATE POLICY "crypto_sentiments_update" ON crypto_sentiments FOR UPDATE USING (true);
CREATE POLICY "crypto_signals_insert" ON crypto_signals FOR INSERT WITH CHECK (true);
CREATE POLICY "crypto_signals_update" ON crypto_signals FOR UPDATE USING (true);
CREATE POLICY "crypto_entities_insert" ON crypto_entities FOR INSERT WITH CHECK (true);
CREATE POLICY "crypto_entities_update" ON crypto_entities FOR UPDATE USING (true);
CREATE POLICY "crypto_relations_insert" ON crypto_relations FOR INSERT WITH CHECK (true);
CREATE POLICY "crypto_relations_update" ON crypto_relations FOR UPDATE USING (true);

-- updated_at 트리거
CREATE OR REPLACE FUNCTION update_crypto_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crypto_posts_updated_at BEFORE UPDATE ON crypto_posts
  FOR EACH ROW EXECUTE FUNCTION update_crypto_updated_at();
CREATE TRIGGER crypto_entities_updated_at BEFORE UPDATE ON crypto_entities
  FOR EACH ROW EXECUTE FUNCTION update_crypto_updated_at();
CREATE TRIGGER crypto_relations_updated_at BEFORE UPDATE ON crypto_relations
  FOR EACH ROW EXECUTE FUNCTION update_crypto_updated_at();
