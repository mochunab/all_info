# AI 카드뉴스 메이커 — 작업 인계 문서

> 최종 작업일: 2026-03-12
> 경로: `/ko/card-news` (Header "커리UP" 메뉴)

---

## 현재 상태

### 완료된 것
1. **페이지 UI** — 주제 입력, 화면 비율 7종 선택, 슬라이드 수 (5/7/10장)
2. **슬라이드 기획 생성** — Gemini 2.5 Flash → JSON (headline, body, image_prompt, color_scheme)
3. **배경 이미지 생성** — Gemini 2.5 Flash Image (Nano Banana) → base64 PNG
4. **미리보기 UI** — 그라데이션 배경 + 텍스트 오버레이, 이미지 로딩 시 스피너 + 프로그레스 바
5. **다운로드** — 전체 이미지 생성 완료 시 "전체 다운로드" 버튼
6. **Header 메뉴** — "커리UP" 추가 (`/card-news`)

### 미완료 (다음 단계)
1. **이미지 + 텍스트 합성** — 현재 이미지와 텍스트가 분리. HTML 템플릿 + Puppeteer 스크린샷으로 최종 카드뉴스 PNG 합성 필요
2. **n8n 워크플로우 연결** — 자동 스케줄 실행, Instagram Graph API 자동 업로드
3. **개별 슬라이드 편집** — 카피/이미지 프롬프트 수정 후 재생성
4. **Google Drive 자동 저장**
5. **i18n** — "커리UP" 라벨 다국어 키 등록 (현재 하드코딩)

---

## 파일 구조

```
app/[locale]/card-news/page.tsx       # 메인 페이지 (주제 입력 → 기획 → 이미지 → 미리보기)
app/api/card-news/route.ts            # 기획 생성 API → generate-card-news Edge Fn 프록시
app/api/card-news/image/route.ts      # 이미지 생성 API → generate-card-image Edge Fn 프록시
supabase/functions/generate-card-news/ # Gemini 2.5 Flash — 슬라이드 기획 JSON
supabase/functions/generate-card-image/ # Gemini 2.5 Flash Image — 배경 이미지 base64
components/Header.tsx                  # "커리UP" 메뉴 추가 (1줄)
```

## Edge Functions

| 함수 | 모델 | 용도 | 배포 완료 |
|------|------|------|----------|
| `generate-card-news` | `gemini-2.5-flash` | 슬라이드 기획 JSON | O |
| `generate-card-image` | `gemini-2.5-flash-image` | 배경 이미지 생성 | O |

둘 다 `google_API_KEY` secret 사용 (Supabase Dashboard에 이미 등록됨).

## 배포 명령어

```bash
supabase functions deploy generate-card-news --project-ref tcpvxihjswauwrmcxhhh
supabase functions deploy generate-card-image --project-ref tcpvxihjswauwrmcxhhh
```

---

## 기술 세부사항

### 이미지 생성 API (Nano Banana)
- 모델: `gemini-2.5-flash-image`
- 엔드포인트: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`
- 인증: `x-goog-api-key` 헤더 (쿼리 파라미터 `?key=` 아님)
- `responseModalities: ['TEXT', 'IMAGE']` (순서 중요)
- `imageConfig.aspectRatio` 지원 ("1:1", "4:5", "9:16", "16:9", "3:4")
- 응답: `candidates[0].content.parts[].inlineData.data` (base64)

### Rate Limit (유료 1등급)
- Nano Banana RPM: **500** (분당)
- 429 재시도: Edge Function 내 최대 4회 (15s/30s/45s/60s 간격)
- 슬라이드 간 5초 딜레이 (프론트엔드)

### 주의사항
- 이전에 `gemini-2.0-flash-exp`, `gemini-2.0-flash-preview-image-generation` 모델명으로 시도 → 404. 올바른 모델명은 `gemini-2.5-flash-image`
- Edge Function 디버그 로깅이 남아있음 (`console.log` + `debug` 필드) — 프로덕션 전 제거 필요
- `@google/genai` SDK v1.44.0 설치됨 (package.json) — Edge Function에서는 미사용 (REST API 직접 호출)

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
