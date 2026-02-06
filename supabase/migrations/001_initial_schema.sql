-- Insight Hub Database Schema
-- Version: 1.0.0
-- Description: Initial schema for articles, crawl sources, and crawl logs

-- ============================================
-- 1. articles 테이블 - 크롤링된 게시글 저장
-- ============================================
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id VARCHAR(32) UNIQUE NOT NULL,           -- URL 해시 기반 고유 ID
  source_name VARCHAR(100) NOT NULL,               -- 출처 이름 (와이즈앱, 브런치 등)
  source_url TEXT NOT NULL,                        -- 원본 게시글 URL
  title VARCHAR(500) NOT NULL,                     -- 게시글 제목
  thumbnail_url TEXT,                              -- 썸네일 이미지 URL
  content_preview TEXT,                            -- 본문 미리보기 (요약용)
  summary TEXT,                                    -- AI 3줄 요약
  author VARCHAR(100),                             -- 작성자
  published_at TIMESTAMPTZ,                        -- 원본 발행일
  crawled_at TIMESTAMPTZ DEFAULT NOW(),            -- 크롤링 시점
  priority INTEGER DEFAULT 1,                      -- 우선순위 (정렬용)
  category VARCHAR(50),                            -- 카테고리 (마케팅, 브랜딩 등)
  is_active BOOLEAN DEFAULT TRUE,                  -- 활성 상태
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- articles 인덱스
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_source_name ON articles(source_name);
CREATE INDEX idx_articles_source_id ON articles(source_id);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_is_active ON articles(is_active);
CREATE INDEX idx_articles_crawled_at ON articles(crawled_at DESC);

-- articles 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. crawl_sources 테이블 - 크롤링 대상 사이트
-- ============================================
CREATE TABLE crawl_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,                      -- 사이트 이름
  base_url TEXT NOT NULL,                          -- 크롤링 시작 URL
  priority INTEGER DEFAULT 1,                      -- 우선순위
  crawler_type VARCHAR(20) DEFAULT 'static',       -- 크롤러 타입 (static/dynamic)
  config JSONB DEFAULT '{}',                       -- 사이트별 크롤러 설정
  is_active BOOLEAN DEFAULT TRUE,                  -- 활성 상태
  last_crawled_at TIMESTAMPTZ,                     -- 마지막 크롤링 시점
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- crawl_sources 인덱스
CREATE INDEX idx_crawl_sources_is_active ON crawl_sources(is_active);
CREATE INDEX idx_crawl_sources_priority ON crawl_sources(priority);

-- ============================================
-- 3. crawl_logs 테이블 - 크롤링 실행 로그
-- ============================================
CREATE TABLE crawl_logs (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES crawl_sources(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),            -- 시작 시점
  finished_at TIMESTAMPTZ,                         -- 완료 시점
  status VARCHAR(20) DEFAULT 'running',            -- 상태 (running/completed/failed)
  articles_found INTEGER DEFAULT 0,                -- 발견된 게시글 수
  articles_new INTEGER DEFAULT 0,                  -- 신규 저장된 게시글 수
  error_message TEXT,                              -- 에러 메시지 (실패 시)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- crawl_logs 인덱스
CREATE INDEX idx_crawl_logs_source_id ON crawl_logs(source_id);
CREATE INDEX idx_crawl_logs_status ON crawl_logs(status);
CREATE INDEX idx_crawl_logs_started_at ON crawl_logs(started_at DESC);

-- ============================================
-- 4. Row Level Security (RLS) 정책
-- ============================================

-- articles: 공개 읽기 허용
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for articles"
  ON articles FOR SELECT
  USING (true);

-- articles: Service role만 쓰기 가능
CREATE POLICY "Service role write access for articles"
  ON articles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- crawl_sources: 공개 읽기 허용
ALTER TABLE crawl_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for crawl_sources"
  ON crawl_sources FOR SELECT
  USING (true);

-- crawl_sources: Service role만 쓰기 가능
CREATE POLICY "Service role write access for crawl_sources"
  ON crawl_sources FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- crawl_logs: 공개 읽기 허용
ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for crawl_logs"
  ON crawl_logs FOR SELECT
  USING (true);

-- crawl_logs: Service role만 쓰기 가능
CREATE POLICY "Service role write access for crawl_logs"
  ON crawl_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 5. 초기 crawl_sources 데이터
-- ============================================
INSERT INTO crawl_sources (name, base_url, priority, crawler_type, config) VALUES
('아이컨슈머', 'http://www.iconsumer.or.kr/news/articleList.html?sc_section_code=S1N17&view_type=sm', 1, 'static', '{"category": "마케팅"}'),
('브런치-모비인사이드', 'https://brunch.co.kr/@mobiinside', 1, 'dynamic', '{"category": "마케팅"}'),
('브런치-스타트업', 'https://brunch.co.kr/keyword/스타트업_경험담?q=g', 1, 'dynamic', '{"category": "스타트업"}'),
('브런치-트렌드미디엄', 'https://brunch.co.kr/magazine/trendmedium', 1, 'dynamic', '{"category": "트렌드"}'),
('스톤브릿지', 'https://stonebc.com/branding-now', 1, 'static', '{"category": "브랜딩"}'),
('오픈애즈', 'https://www.openads.co.kr/content?category=CC92', 1, 'dynamic', '{"category": "마케팅"}'),
('와이즈앱', 'https://www.wiseapp.co.kr/insight/', 1, 'dynamic', '{"category": "트렌드"}'),
('리테일톡', 'https://retailtalk.co.kr/Strategy', 1, 'static', '{"category": "리테일"}'),
('바이브랜드', 'https://buybrand.stibee.com/', 1, 'dynamic', '{"category": "브랜딩"}');
