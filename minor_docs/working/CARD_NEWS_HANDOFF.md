# AI 카드뉴스 메이커 — 작업 인계 문서

> 최종 작업일: 2026-03-15
> 경로: `/ko/card-news` (Header "커리UP" 메뉴)

---

## 현재 상태

### 완료된 것
1. **3단계 플로우** — 주제 입력(input) → 기획안 검토/수정(plan) → 이미지 제작(production)
2. **피드 콘텐츠 선택** — ArticlePickerModal (홈피드/마이피드 탭, 검색, 요약글 표시, 원문 바로가기, 최대 5개 제한)
3. **원문 본문 크롤링** — 기획안 생성 시 선택된 기사의 원문 URL을 기존 크롤러 인프라로 크롤링하여 전체 본문을 AI에 전달
4. **슬라이드 기획 생성** — Gemini 2.5 Flash → JSON (headline, body, image_prompt, search_keyword, color_scheme)
5. **행동경제학 카피 전략** — cover 슬라이드에 손실 회피, 구체적 숫자, FOMO 등 8가지 심리 전략 + 9가지 카피 유형 프롬프트 적용
6. **이미지 선정 전략** — 호기심 유발, 주제를 관통하는 한 장면, 감정 전달, 구체적 피사체 등 image_prompt/search_keyword 생성 가이드
7. **AI 기획안 수정 채팅** — 사용자가 채팅으로 기획안 수정 요청 → AI가 기존 기획안 기반으로 재생성
8. **Unsplash + Pexels 이미지 연동** — Unsplash 우선, 실패(403/에러) 시 Pexels 자동 fallback. 3단계 키워드 fallback, 키워드별 page 자동 증가로 중복 방지
9. **2단계 이미지 생성** — 커버 이미지 먼저 생성 → 사용자 확인(재생성 가능) → 승인 후 나머지 일괄 생성
10. **AI 이미지 생성 (보조)** — Gemini 2.5 Flash Image → base64 PNG, 레퍼런스 이미지 전달로 톤앤매너 통일
11. **AI 이미지 3장 병렬 생성** — 나머지 슬라이드 이미지를 3장씩 `Promise.allSettled` 배치 병렬 처리 (배치 간 5초 대기)
12. **슬라이드 프리뷰 차별화** — cover(대형 헤드라인, 좌하단), content(헤드라인 하이라이트 + body 표시), cta(중앙 강조)
13. **개별 슬라이드 이미지 재생성** — 슬라이드별 새로고침 버튼 (hover 시 표시), slide_context 기반 재생성
14. **다운로드** — 전체 이미지 생성 완료 시 "전체 다운로드" 버튼
15. **Header 메뉴** — "커리UP" 추가 (`/card-news`)
16. **화면 비율 7종** — 기본값 인스타 피드 (세로) 4:5

### 미완료 (다음 단계)
1. **이미지 + 텍스트 합성** — 현재 이미지와 텍스트가 분리. HTML 템플릿 + Puppeteer 스크린샷으로 최종 카드뉴스 PNG 합성 필요
2. **n8n 워크플로우 연결** — 자동 스케줄 실행, Instagram Graph API 자동 업로드
3. **Google Drive 자동 저장**
4. **i18n** — "커리UP" 라벨 다국어 키 등록 (현재 하드코딩)

---

## 유저 플로우

```
[Step 1: input]
  주제 직접 입력 또는 "피드에서 주제 찾기" → ArticlePickerModal
  → 홈피드/마이피드 탭, 검색, 체크박스 선택 (최대 5개), 원문 바로가기
  → 선택된 콘텐츠 기반으로 주제 자동 생성
  → 슬라이드 수 선택 (5/7/10장)
  → "기획안 생성하기" 클릭
    → 피드 콘텐츠 선택된 경우: 원문 본문 크롤링 ("본문 가져오는 중...")
    → 전체 본문 + 원문 링크를 AI에 전달 ("기획안 생성 중...")

[Step 2: plan]
  슬라이드 구성 리스트 (cover/content/cta 타입별 표시)
  → 채팅으로 AI에 수정 요청 (기존 기획안 + 수정 지시 전달)
  → "이 기획안으로 제작하기"

[Step 3: production]
  Phase 1 — 화면 비율 선택 → "커버 이미지 생성" (Unsplash/Pexels) → 커버 프리뷰
    → "다시 생성" (재생성) 또는 "이 스타일로 전체 제작" (승인)
    → 하단 "또는 AI로 이미지 생성" 텍스트 버튼 (Gemini 보조 옵션)
  Phase 2 — 나머지 슬라이드 이미지 3장씩 병렬 생성 (키워드별 page 자동 증가로 중복 방지)
    → 개별 슬라이드 새로고침 버튼 (hover 시 표시, slide_context 기반 재생성)
    → 슬라이드 타입별 차별화된 프리뷰:
      - cover: 대형 헤드라인 + 좌하단 배치 (bottom 12%)
      - content: 헤드라인 하이라이트 배경 + body 텍스트 3줄
      - cta: 중앙 정렬 굵은 메시지
    → 프로그레스 바 + "전체 다운로드"
```

---

## 파일 구조

```
app/[locale]/card-news/page.tsx            # 메인 페이지 (3단계 플로우 + ArticlePickerModal)
app/api/card-news/route.ts                 # 기획 생성 API → generate-card-news Edge Fn 프록시
app/api/card-news/image/route.ts           # 이미지 생성 API → generate-card-image Edge Fn 프록시 (reference_image 지원)
app/api/card-news/unsplash/route.ts        # 이미지 검색 프록시 (Unsplash 우선 → Pexels fallback)
app/api/card-news/fetch-content/route.ts   # 원문 본문 크롤링 API (articleIds → source config 기반 extractContent)
supabase/functions/generate-card-news/     # Gemini 2.5 Flash — 슬라이드 기획 JSON (행동경제학 + 이미지 선정 전략)
supabase/functions/generate-card-image/    # Gemini 2.5 Flash Image — 배경 이미지 base64 (레퍼런스 이미지 지원)
components/Header.tsx                      # "커리UP" 메뉴 추가
```

## Edge Functions

| 함수 | 모델 | 용도 | 배포 완료 |
|------|------|------|----------|
| `generate-card-news` | `gemini-2.5-flash` | 슬라이드 기획 JSON + 행동경제학 카피 + 이미지 선정 전략 | O |
| `generate-card-image` | `gemini-2.5-flash-image` | 배경 이미지 생성 (레퍼런스 전달 지원) | O |

둘 다 `google_API_KEY` secret 사용 (Supabase Dashboard에 이미 등록됨).

## 배포 명령어

```bash
supabase functions deploy generate-card-news --project-ref tcpvxihjswauwrmcxhhh
supabase functions deploy generate-card-image --project-ref tcpvxihjswauwrmcxhhh
```

---

## 기술 세부사항

### 원문 본문 크롤링 (`/api/card-news/fetch-content`)
- POST `{ articleIds: string[] }` (최대 5개)
- article의 `source_id`로 DB에서 소스 config (`crawler_type`, `content_selectors`) 조회
- `fetchWithTimeout` + `extractContent` (Readability 기반)로 전체 본문 추출
- 크롤링 실패 시 기존 `content_preview` (500자)로 fallback
- 병렬 처리 (`Promise.all`)
- `handleGeneratePlan`에서 기획안 생성 버튼 클릭 시 호출 (선택 시점이 아님)

### 이미지 검색 (Unsplash + Pexels fallback)
- **Unsplash** (1차): `UNSPLASH_ACCESS_KEY` — Demo 50회/시간, Production 신청 중 (승인 시 5,000회/시간)
- **Pexels** (2차 fallback): `PEXELS_API_KEY` — 200회/시간, 20,000회/월
- 프록시: `/api/card-news/unsplash` — Unsplash 실패(403/에러/결과없음) 시 자동 Pexels fallback
- 3단계 키워드 fallback: 키워드+orientation → 키워드만 → 첫 단어
- 키워드별 page 자동 증가 (`keywordPageMap`) — 같은 키워드라도 다른 사진 반환
- 응답에 `source: 'unsplash' | 'pexels'` 필드 포함 → 크레딧 표시 분기
- Attribution: "Photo by [name] on Unsplash" 또는 "Photo by [name] on Pexels"
- Download tracking (`/photos/{id}/download`) per Unsplash API 가이드라인
- CSP `img-src`에 `images.unsplash.com`, `images.pexels.com` 추가 완료

### AI 이미지 병렬 생성
- 나머지 슬라이드(커버 제외)를 **3장씩 `Promise.allSettled` 배치** 병렬 처리
- 배치 간 5초 대기 (rate limit 방어)
- 개별 실패해도 나머지 정상 처리
- 예: 9장 → 기존 ~72초 → 변경 후 ~22초 (3배치 × 병렬)

### 개별 슬라이드 이미지 재생성
- 각 슬라이드 hover 시 우측 상단 새로고침 버튼 표시 (`slide-regen-btn`, opacity 0→1)
- `regenerateSlideImage(slide)` — imageMode에 따라 Unsplash/Pexels 또는 AI 재생성
- AI 재생성 시 `slide_context` (headline, body, type, topic) 전달 → image_prompt 대신 컨텍스트 기반 생성
- 커버(slide 1) 재생성 시 `coverBase64Ref` 업데이트
- content/cta 오버레이에 `pointerEvents: 'none'` 적용 → 버튼 클릭 차단 방지

### 이미지 선정 전략 (generate-card-news 프롬프트)
- 주제를 관통하는 한 장면 (추상적 배경 ❌ → 구체적 상황/장면 ✅)
- 호기심 유발 — 이미지만으로 "이게 뭐지?" 질문 생성
- 감정 전달 — 사람의 표정, 몸짓, 강렬한 색감/대비
- 구체적 피사체 — "business" ❌ → "stressed office worker at desk" ✅
- cover/content/cta 별 다른 톤 가이드
- search_keyword 중복 금지 규칙

### 슬라이드 프리뷰 디자인
- **Phase 1 커버**: 28px/900 weight 헤드라인, bottom 12% 배치, drop-shadow, 하단 50% gradient 분리
- **Phase 2 그리드**:
  - cover: 15px/900 weight, bottom 12%, gradient 분리
  - content: 헤드라인에 color_scheme 하이라이트 배경 + body 3줄 clamp
  - cta: 중앙 정렬, 16px/900 weight, 반투명 오버레이

### 이미지 생성 API (Gemini 2.5 Flash Image)
- 모델: `gemini-2.5-flash-image`
- 엔드포인트: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`
- 인증: `x-goog-api-key` 헤더
- `responseModalities: ['TEXT', 'IMAGE']` (순서 중요)
- `imageConfig.aspectRatio` 지원 ("1:1", "4:5", "9:16", "16:9", "3:4")
- 응답: `candidates[0].content.parts[].inlineData.data` (base64)

### 레퍼런스 이미지 기반 톤앤매너 통일
- 커버 이미지 생성 후 raw base64를 `coverBase64Ref`에 저장
- 2번째 슬라이드부터 `reference_image` 파라미터로 커버 base64 전달
- Edge Function에서 `inlineData`로 Gemini에 전달 + "same visual style, color palette, lighting, mood" 프롬프트

### 행동경제학 카피 전략 (generate-card-news 프롬프트)
- 8가지 심리 전략: 단일 메시지 집중, 손실 회피, 구체적 숫자, 타겟 지목, 간편성, FOMO, 인정욕구, 확실성 효과
- 9가지 카피 유형: 문제점 후벼파기, 비교/경쟁 자극, 경고/파국, 이익 약속, 호기심 유발, 해결책 제시, 질문/테스트, 행동 촉구, 시의성/신선함
- cover의 headline에 주제와 가장 맞는 2~3가지 전략을 조합

### ArticlePickerModal
- 홈피드/마이피드 탭 (마이피드는 로그인 필요)
- **최대 5개** 선택 제한 (하단에 "N/5개 선택됨" 표시)
- 항상 체크 해지 상태로 시작 (`initialSelected={[]}`)
- 300ms debounce 검색
- 체크박스 리스트 (source badge, tags, headline + summary 2줄 clamp)
- 원문 바로가기 아이콘 (source_url → 새 탭)
- sessionStorage 캐시 활용 (`ih:home:articles`, `ih:my:articles`)
- 페이지네이션 ("더 보기" 버튼)

### Rate Limit (유료 1등급)
- Nano Banana RPM: **500** (분당)
- 429 재시도: Edge Function 내 최대 4회 (15s/30s/45s/60s 간격)
- 슬라이드 간 5초 딜레이 (프론트엔드, 배치 간)

### 주의사항
- 이전에 `gemini-2.0-flash-exp`, `gemini-2.0-flash-preview-image-generation` 모델명으로 시도 → 404. 올바른 모델명은 `gemini-2.5-flash-image`
- Edge Function에서 변수명 중복 주의 (Deno strict mode에서 `const` 재선언 시 503 발생)
- `@google/genai` SDK v1.44.0 설치됨 (package.json) — Edge Function에서는 미사용 (REST API 직접 호출)
- content/cta 슬라이드 오버레이에 `pointerEvents: 'none'` 필수 (없으면 새로고침 버튼 클릭 차단됨)

---

## 환경변수

| 변수 | 위치 | 용도 |
|------|------|------|
| `google_API_KEY` | Supabase Secrets | Gemini API (Edge Functions) |
| `UNSPLASH_ACCESS_KEY` | `.env.local` + Vercel | Unsplash 이미지 검색 (1차) |
| `PEXELS_API_KEY` | `.env.local` + Vercel | Pexels 이미지 검색 (fallback) |

---

## n8n (설치 완료, 미연결)
- 경로: `~/n8n-local` (npm local install, v2.11.2)
- 실행: `cd ~/n8n-local && npx n8n start` → http://localhost:5678
- 카드뉴스 자동화 워크플로우 아직 미구성

---

## 화면 비율 옵션

| ID | 라벨 | 비율 | 픽셀 | 플랫폼 |
|----|------|------|------|--------|
| ig-portrait | 인스타 피드 (세로) | 4:5 | 1080×1350 | Instagram |
| ig-square | 인스타 피드 | 1:1 | 1080×1080 | Instagram |
| ig-story | 스토리 / 릴스 | 9:16 | 1080×1920 | Instagram |
| x-feed | X (Twitter) | 16:9 | 1200×675 | X |
| yt-thumb | YouTube 썸네일 | 16:9 | 1280×720 | YouTube |
| naver-blog | 네이버 블로그 | 3:4 | 900×1200 | Naver |
| linkedin | LinkedIn | 1:1 | 1080×1080 | LinkedIn |
