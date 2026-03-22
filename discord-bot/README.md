# InsightHub Discord Bot

밈코인 시그널 봇 + 채널 메시지 크롤링

## Setup

### 1. Discord Application 생성

1. https://discord.com/developers/applications → New Application
2. **Bot** 탭 → Reset Token → 토큰 복사
3. **Bot** 탭 → Privileged Gateway Intents → **MESSAGE CONTENT INTENT** 켜기
4. **OAuth2** 탭 → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Read Message History`, `Use Slash Commands`, `Embed Links`
5. 생성된 URL로 봇을 테스트 서버에 초대

### 2. 환경변수 설정

```bash
cp .env.example .env
# .env에 토큰/키 입력
```

### 3. 의존성 설치 + 명령어 등록

```bash
cd discord-bot
npm install
npm run deploy-commands   # 슬래시 명령어 글로벌 등록 (1회)
```

### 4. DB 마이그레이션

```bash
# 프로젝트 루트에서
supabase db push --project-ref tcpvxihjswauwrmcxhhh
# 또는 Dashboard에서 034_discord_alert_channels.sql 실행
```

### 5. 봇 실행

```bash
npm run dev    # 개발 (watch mode)
npm start      # 프로덕션
```

## Commands

| 명령어 | 설명 |
|--------|------|
| `/trending` | 현재 Hot 코인 Top 8 |
| `/signal DOGE` | 특정 코인 FOMO/FUD 스코어 |
| `/alerts on` | 이 채널에 자동 알림 (score >= 60) |
| `/stats` | 백테스트 적중률 리포트 |
| `/about` | 봇 소개 + 데이터 수집 고지 |

## 배포 (프로덕션)

Railway / Render / Fly.io 무료 티어에 배포:

```bash
# Railway
railway init
railway up

# 또는 Render
# → New Web Service → discord-bot 디렉토리 → Start Command: npm start
```

## 채널 크롤링 규칙

- `crypto`, `memecoin`, `trading`, `signals`, `general` 등 키워드가 포함된 채널만 수집
- `bot-commands`, `rules`, `announcements`, `welcome` 등은 제외
- 20자 미만 메시지 스킵
- 봇 메시지 스킵
