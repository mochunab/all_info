# Insight Hub

> 매일 아침, 비즈니스 인사이트를 한 곳에서. AI가 3줄로 요약해드립니다.

## 프로젝트 소개

Insight Hub는 다양한 비즈니스 콘텐츠 소스(블로그, 뉴스레터, RSS 등)를 자동 크롤링하고, OpenAI를 활용해 1줄 요약 + 3개 태그를 자동 생성하는 인사이트 큐레이션 플랫폼입니다.

### 핵심 기능

- **다중 소스 크롤링**: 정적 페이지, SPA, RSS, 네이버 블로그, 브런치, 뉴스레터, API 등 7가지 크롤링 전략
- **AI 요약**: OpenAI (GPT-4o-mini / GPT-5-nano) 기반 1줄 요약 + 태그 3개 자동 생성
- **다국어 지원**: 한국어, English, 日本語, 中文 4개 언어 UI
- **실시간 검색/필터**: 키워드 검색, 카테고리 필터링, 소스별 필터링
- **자동 크롤링**: Vercel Cron으로 매일 아침 9시 자동 수집
- **반응형 UI**: Desktop, Tablet, Mobile 지원

---

## 5분 빠른 시작

### 1. 환경 요구사항

- Node.js 18+
- npm
- Supabase 프로젝트 (무료 플랜 가능)
- OpenAI API Key

### 2. 설치

```bash
git clone <repository-url>
cd insight-hub
npm install
```

### 3. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일 편집:

```bash
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# OpenAI (필수)
OPENAI_API_KEY=sk-...

# Cron 인증 (필수)
CRON_SECRET=your_random_secret

# Edge Function 사용 여부 (선택)
USE_EDGE_FUNCTION=false
```

### 4. Supabase 테이블 생성

Supabase Dashboard에서 다음 테이블을 생성하세요:

- `articles` - 크롤링된 아티클 저장
- `crawl_sources` - 크롤링 소스 관리
- `crawl_logs` - 크롤링 실행 로그
- `categories` - 카테고리 관리

> 상세 스키마: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

### 5. 개발 서버 실행

```bash
npm run dev
# → http://localhost:3000
```

### 6. 크롤링 테스트

```bash
# Dry-run (DB 저장 없이 테스트)
npm run crawl:dry -- --verbose

# 실제 크롤링
npm run crawl

# 특정 소스만 크롤링
npm run crawl -- --source=1

# 소스 목록 확인
npm run crawl -- --list
```

---

## 스크립트 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (localhost:3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run crawl` | 전체 크롤링 실행 |
| `npm run crawl:dry` | Dry-run 테스트 (DB 저장 없음) |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL), Supabase Edge Functions |
| AI | OpenAI API (GPT-4o-mini, GPT-5-nano) |
| i18n | 커스텀 번역 시스템 (ko, en, ja, zh) |
| Crawling | Cheerio, Puppeteer, rss-parser, @mozilla/readability |
| Deployment | Vercel (Cron Jobs) |

---

## 프로젝트 구조 (요약)

```
insight-hub/
├── app/              # Next.js App Router (페이지 + API)
├── components/       # React 컴포넌트 (7개)
├── lib/              # 비즈니스 로직 (Supabase, 크롤러, AI)
├── types/            # TypeScript 타입 정의
├── scripts/          # CLI 크롤링 스크립트
├── supabase/         # Edge Functions
└── key_docs/         # 프로젝트 문서
```

> 상세 구조: [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)

---

## 배포

### Vercel 배포

```bash
# Vercel CLI
npm install -g vercel
vercel --prod
```

### 환경변수 (Vercel Dashboard)

Vercel Dashboard > Settings > Environment Variables에서 `.env.local`과 동일한 변수 등록.

### Cron Job

`vercel.json`에 설정됨:
- `/api/crawl/run` - 매일 00:00 UTC (09:00 KST)
- maxDuration: 300초 (크롤링 + 요약)

---

## 관련 문서

- [CLAUDE.md](./CLAUDE.md) - AI 개발 규칙 (Claude Code 필독)
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) - 전체 아키텍처
- [DECISIONS.md](./DECISIONS.md) - 설계 결정 기록
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - DB 스키마
- [components-inventory.md](./components-inventory.md) - 컴포넌트 목록
