# AI 카드뉴스 메이커 — 작업 인계 문서

> 최종 작업일: 2026-03-12
> 경로: `/ko/card-news` (Header "커리UP" 메뉴)

---

## 현재 상태

### 완료된 것
1. **3단계 플로우** — 주제 입력(input) → 기획안 검토/수정(plan) → 이미지 제작(production)
2. **피드 콘텐츠 선택** — ArticlePickerModal (홈피드/마이피드 탭, 검색, 요약글 표시, 원문 바로가기 아이콘, sessionStorage 캐시 활용)
3. **슬라이드 기획 생성** — Gemini 2.5 Flash → JSON (headline, body, image_prompt, color_scheme)
4. **행동경제학 카피 전략** — cover 슬라이드에 손실 회피, 구체적 숫자, FOMO 등 8가지 심리 전략 + 9가지 카피 유형 프롬프트 적용
5. **AI 기획안 수정 채팅** — 사용자가 채팅으로 기획안 수정 요청 → AI가 기존 기획안 기반으로 재생성
6. **2단계 이미지 생성** — 커버 이미지 먼저 생성 → 사용자 확인(재생성 가능) → 승인 후 커버를 레퍼런스로 나머지 이미지 일괄 생성 (톤앤매너 통일)
7. **배경 이미지 생성** — Gemini 2.5 Flash Image → base64 PNG, 레퍼런스 이미지 전달 지원
8. **미리보기 UI** — 커버 단독 프리뷰 + 전체 그리드, 프로그레스 바
9. **다운로드** — 전체 이미지 생성 완료 시 "전체 다운로드" 버튼
10. **Header 메뉴** — "커리UP" 추가 (`/card-news`)
11. **화면 비율 7종** — Instagram, X, YouTube, Naver, LinkedIn

### 미완료 (다음 단계)
1. **이미지 + 텍스트 합성** — 현재 이미지와 텍스트가 분리. HTML 템플릿 + Puppeteer 스크린샷으로 최종 카드뉴스 PNG 합성 필요
2. **n8n 워크플로우 연결** — 자동 스케줄 실행, Instagram Graph API 자동 업로드
3. **개별 슬라이드 편집** — 카피/이미지 프롬프트 수정 후 개별 재생성
4. **Google Drive 자동 저장**
5. **i18n** — "커리UP" 라벨 다국어 키 등록 (현재 하드코딩)

---

## 유저 플로우

```
[Step 1: input]
  주제 직접 입력 또는 "피드에서 주제 찾기" → ArticlePickerModal
  → 홈피드/마이피드 탭, 검색, 체크박스 선택, 원문 바로가기
  → 선택된 콘텐츠 기반으로 주제 자동 생성
  → 슬라이드 수 선택 (5/7/10장)
  → "기획안 생성하기"

[Step 2: plan]
  슬라이드 구성 리스트 (cover/content/cta 타입별 표시)
  → 채팅으로 AI에 수정 요청 (기존 기획안 + 수정 지시 전달)
  → "이 기획안으로 제작하기"

[Step 3: production]
  Phase 1 — 화면 비율 선택 → "커버 이미지 생성" → 커버 프리뷰
    → "다시 생성" (재생성) 또는 "이 스타일로 전체 제작" (승인)
  Phase 2 — 나머지 슬라이드 이미지 생성 (커버를 레퍼런스로 전달)
    → 전체 그리드 미리보기 + 프로그레스 바
    → "전체 다운로드"
```

---

## 파일 구조

```
app/[locale]/card-news/page.tsx        # 메인 페이지 (3단계 플로우 + ArticlePickerModal)
app/api/card-news/route.ts             # 기획 생성 API → generate-card-news Edge Fn 프록시
app/api/card-news/image/route.ts       # 이미지 생성 API → generate-card-image Edge Fn 프록시 (reference_image 지원)
supabase/functions/generate-card-news/  # Gemini 2.5 Flash — 슬라이드 기획 JSON (행동경제학 카피 전략 포함)
supabase/functions/generate-card-image/ # Gemini 2.5 Flash Image — 배경 이미지 base64 (레퍼런스 이미지 지원)
components/Header.tsx                   # "커리UP" 메뉴 추가 (1줄)
```

## Edge Functions

| 함수 | 모델 | 용도 | 배포 완료 |
|------|------|------|----------|
| `generate-card-news` | `gemini-2.5-flash` | 슬라이드 기획 JSON + 행동경제학 카피 | O |
| `generate-card-image` | `gemini-2.5-flash-image` | 배경 이미지 생성 (레퍼런스 전달 지원) | O |

둘 다 `google_API_KEY` secret 사용 (Supabase Dashboard에 이미 등록됨).

## 배포 명령어

```bash
supabase functions deploy generate-card-news --project-ref tcpvxihjswauwrmcxhhh
supabase functions deploy generate-card-image --project-ref tcpvxihjswauwrmcxhhh
```

---

## 기술 세부사항

### 이미지 생성 API (Gemini 2.5 Flash Image)
- 모델: `gemini-2.5-flash-image`
- 엔드포인트: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`
- 인증: `x-goog-api-key` 헤더 (쿼리 파라미터 `?key=` 아님)
- `responseModalities: ['TEXT', 'IMAGE']` (순서 중요)
- `imageConfig.aspectRatio` 지원 ("1:1", "4:5", "9:16", "16:9", "3:4")
- 응답: `candidates[0].content.parts[].inlineData.data` (base64)

### 레퍼런스 이미지 기반 톤앤매너 통일
- 커버 이미지 생성 후 raw base64를 `coverBase64Ref`에 저장
- 2번째 슬라이드부터 `reference_image` 파라미터로 커버 base64 전달
- Edge Function에서 `inlineData`로 Gemini에 전달 + "same visual style, color palette, lighting, mood" 프롬프트 포함
- 주의: `parts` 변수명 충돌 방지 — 요청용 `parts` / 응답 파싱용 `responseParts`로 분리

### 행동경제학 카피 전략 (generate-card-news 프롬프트)
- 8가지 심리 전략: 단일 메시지 집중, 손실 회피, 구체적 숫자, 타겟 지목, 간편성, FOMO, 인정욕구, 확실성 효과
- 9가지 카피 유형: 문제점 후벼파기, 비교/경쟁 자극, 경고/파국, 이익 약속, 호기심 유발, 해결책 제시, 질문/테스트, 행동 촉구, 시의성/신선함
- cover의 headline에 주제와 가장 맞는 2~3가지 전략을 조합

### ArticlePickerModal
- 홈피드/마이피드 탭 (마이피드는 로그인 필요)
- 300ms debounce 검색
- 체크박스 리스트 (source badge, tags, headline + summary details 2줄 clamp)
- 원문 바로가기 아이콘 (source_url → 새 탭)
- sessionStorage 캐시 활용 (`ih:home:articles`, `ih:my:articles` — HomeFeed/MyFeed가 이미 저장하는 키 재사용)
- 페이지네이션 ("더 보기" 버튼)

### Rate Limit (유료 1등급)
- Nano Banana RPM: **500** (분당)
- 429 재시도: Edge Function 내 최대 4회 (15s/30s/45s/60s 간격)
- 슬라이드 간 5초 딜레이 (프론트엔드)

### 주의사항
- 이전에 `gemini-2.0-flash-exp`, `gemini-2.0-flash-preview-image-generation` 모델명으로 시도 → 404. 올바른 모델명은 `gemini-2.5-flash-image`
- Edge Function 디버그 로깅이 남아있음 (`console.log` + `debug` 필드) — 프로덕션 전 제거 필요
- `@google/genai` SDK v1.44.0 설치됨 (package.json) — Edge Function에서는 미사용 (REST API 직접 호출)
- Edge Function에서 변수명 중복 주의 (Deno strict mode에서 `const` 재선언 시 503 발생)

---

## n8n (설치 완료, 미연결)
- 경로: `~/n8n-local` (npm local install, v2.11.2)
- 실행: `cd ~/n8n-local && npx n8n start` → http://localhost:5678
- 카드뉴스 자동화 워크플로우 아직 미구성

---

## 화면 비율 옵션

| ID | 라벨 | 비율 | 픽셀 | 플랫폼 |
|----|------|------|------|--------|
| ig-square | 인스타 피드 | 1:1 | 1080×1080 | Instagram |
| ig-portrait | 인스타 피드 (세로) | 4:5 | 1080×1350 | Instagram |
| ig-story | 스토리 / 릴스 | 9:16 | 1080×1920 | Instagram |
| x-feed | X (Twitter) | 16:9 | 1200×675 | X |
| yt-thumb | YouTube 썸네일 | 16:9 | 1280×720 | YouTube |
| naver-blog | 네이버 블로그 | 3:4 | 900×1200 | Naver |
| linkedin | LinkedIn | 1:1 | 1080×1080 | LinkedIn |
