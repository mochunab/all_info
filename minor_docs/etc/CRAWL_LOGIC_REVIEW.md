# 크롤링 로직 점검 결과

> 점검일: 2026-03-07 (v1.8.6)
> 점검 범위: 크롤링 오케스트레이터, 전략 해석기, 개별 전략 8종, 지원 모듈
> 상태: **더블 체크 필요** — 각 항목의 실제 영향도와 수정 필요성을 검증해주세요

---

## 더블 체크 가이드

각 항목에 대해 다음을 확인해주세요:
1. **실제 코드에서 해당 라인/로직이 맞는지** 확인
2. **실제 런타임에서 문제가 발생하는 시나리오**가 현실적인지 판단
3. 수정 시 **사이드이펙트** 여부 확인
4. 항목별 `[확인됨]` / `[과잉지적]` / `[수정완료]` 태그 추가

---

## HIGH — 즉시 수정 필요

### H1. 타임아웃 Promise 누수
- **파일**: `lib/crawlers/index.ts` ~373행
- **현상**: `Promise.race([crawlPromise, timeoutPromise])` 사용 시, crawl이 먼저 완료되어도 `setTimeout`이 취소 안 됨
- **영향**: 30초 뒤 unhandled rejection 발생 가능, 다수 소스 처리 시 누적
- **수정 방향**: `clearTimeout`으로 타이머 정리
- **더블체크**: `timeoutPromise` 생성 부분과 `Promise.race` 흐름 확인

### H2. crawl_logs 항상 "completed" 기록
- **파일**: `lib/crawlers/index.ts` ~986행, `app/api/crawl/run/route.ts` ~190행
- **현상**: `runCrawler()`가 내부에서 모든 에러를 catch하고 `result.errors[]`에 담아 반환 (throw 안 함). route의 catch 블록은 dead code
- **영향**: crawl_logs에 에러 있어도 `status: 'completed'`로 기록 → 실패 모니터링 불가
- **수정 방향**: `result.errors.length > 0`이면 `status: 'failed'`로 기록하거나, `runCrawler`가 치명적 에러 시 throw하도록 변경
- **더블체크**: `runCrawler` 반환 구조와 route의 try/catch 흐름 확인

### H3. sitemap 전략 — 열등한 date parser 사용
- **파일**: `lib/crawlers/strategies/sitemap.ts` → `import { isWithinDays } from '../base'`
- **비교**: `base.ts`의 `isWithinDays`는 `new Date(dateString)`만 사용. `date-parser.ts`는 한국어 상대 날짜("3일 전"), dot 형식("2024.01.15") 등 지원
- **영향**: sitemap 전략에서 비표준 날짜 형식 파싱 실패 → 오래된 기사 필터링 안 됨 (파싱 실패 시 include 처리)
- **수정 방향**: `sitemap.ts`의 import를 `'../date-parser'`로 변경
- **더블체크**: `sitemap.ts`와 `firecrawl.ts`의 import 경로 확인, `base.ts`의 `isWithinDays` 로직 확인

### H4. API 전략 cursor 페이지네이션 미구현
- **파일**: `lib/crawlers/strategies/api.ts` ~129행
- **현상**: `case 'cursor':` 블록이 `break`만 있음. 이전 응답에서 cursor 추출/전달 없음
- **영향**: cursor 기반 API는 첫 페이지만 가져오고 이후 동일 페이지 반복 fetch → 중복 아이템
- **수정 방향**: 응답에서 cursor 추출 → 다음 요청 params에 포함
- **더블체크**: 현재 cursor 페이지네이션을 사용하는 소스가 있는지 DB 확인

### H5. firecrawl 전략 crawlContent에 빈 HTML 전달
- **파일**: `lib/crawlers/strategies/firecrawl.ts` ~132행
- **현상**: `extractContent('', url, config)` — 첫 인자가 빈 문자열
- **영향**: 본문 추출이 항상 빈 문자열 반환
- **더블체크**: firecrawl 전략이 실제로 사용되고 있는지 확인 (레거시/미사용 가능성)

---

## MEDIUM — 개선 필요

### M1. `last_crawled_at` 무조건 업데이트
- **파일**: `app/api/crawl/run/route.ts` ~173행
- **현상**: 에러/스킵/0건 시에도 `last_crawled_at` 갱신
- **영향**: 반복 실패 소스의 재시도 우선순위가 밀림
- **더블체크**: `last_crawled_at`를 스케줄링에 사용하는 로직이 있는지 확인

### M2. 병렬 실행 시 Puppeteer 경합
- **파일**: `app/api/crawl/run/route.ts` ~127행, `lib/crawlers/index.ts` 전반
- **현상**: STATIC 소스를 `parallelSources`로 분류하지만, fallback/auto-recovery에서 SPA(Puppeteer) 사용 가능
- **영향**: 병렬 실행 중 브라우저 싱글톤 공유 충돌 (close/launch 경합)
- **더블체크**: `spa.ts`의 `getBrowser()`/`closeBrowser()` 싱글톤 패턴과 실제 병렬 호출 시나리오 확인

### M3. Google 검색 `gl` 파라미터 무시
- **파일**: `lib/crawlers/url-optimizer.ts` ~114행
- **현상**: 원본 URL의 `gl` 쿼리 파라미터를 안 읽고, `hl`에서 단순 매핑 (`ko→KR, ja→JP, zh→CN, 기타→US`)
- **수정 방향**: `const gl = urlObj.searchParams.get('gl') || (hl 기반 매핑)`
- **더블체크**: 실제 Google 검색 URL에 `gl` 파라미터가 포함되는지 확인

### M4. 네이버 검색 탭 무시
- **파일**: `lib/crawlers/url-optimizer.ts` ~130행
- **현상**: `search.naver.com/search.naver` → 항상 News API로 변환. `where=blog`, `where=web` 등도 뉴스로 변환됨
- **영향**: 블로그/웹 검색 URL 등록 시 뉴스 결과 반환
- **더블체크**: 실제로 뉴스 외 네이버 검색 URL이 등록되는 케이스가 있는지 확인

### M5. `naver.com` 과매칭 → PLATFORM_NAVER
- **파일**: `lib/crawlers/infer-type.ts` ~131-136행
- **현상**: `urlLower.includes('naver.com')` → `shopping.naver.com`, `map.naver.com` 등도 `PLATFORM_NAVER`(0.85)
- **수정 방향**: `blog.naver.com`만 PLATFORM_NAVER, 나머지 naver.com은 일반 처리
- **더블체크**: `inferCrawlerTypeEnhanced` vs 레거시 `inferCrawlerType` 사용처 확인

### M6. `/feed` 부분 문자열 매칭 오탐
- **파일**: `lib/crawlers/infer-type.ts` ~121행
- **현상**: `urlLower.includes('/feed')` → `/feedback`, `/feedforward` 등도 RSS로 판정
- **수정 방향**: 정규식 `/\/feed(\/|$|\?)/` 등으로 경계 매칭
- **더블체크**: 실제 오탐 사례가 있었는지 로그 확인

### M7. SPA 전략 `extractDateFromText` 미적용
- **파일**: `lib/crawlers/strategies/spa.ts`
- **현상**: STATIC은 날짜 셀렉터 실패 시 `extractDateFromText($el.text())` 폴백 있음. SPA는 없음
- **영향**: 날짜가 텍스트에만 포함된 사이트에서 SPA 전략의 날짜 필터링 무력화
- **더블체크**: `page.evaluate` 내부에서 Node.js 함수 호출 불가 → 다른 접근 필요

### M8. API 전략 썸네일 미매핑
- **파일**: `lib/crawlers/strategies/api.ts` ~217행
- **현상**: `responseMapping`에 `thumbnail` 필드 정의되어 있으나 `parseResponse`에서 실제로 안 읽음
- **더블체크**: `parseResponse` 메서드에서 thumbnail 관련 코드 존재 여부 확인

### M9. Newsletter 전략 container 셀렉터 무시
- **파일**: `lib/crawlers/strategies/newsletter.ts`
- **현상**: `config.selectors.container` 설정되어도 `$(finalSelectors.item)`으로 전체 문서 검색
- **비교**: STATIC은 `$container.find(selectors.item)` 사용
- **더블체크**: newsletter 소스 중 container 셀렉터가 설정된 케이스가 있는지 확인

### M10. 브런치(Kakao) RSS URL `@@` 이중
- **파일**: `lib/crawlers/strategies/kakao.ts` ~84행
- **현상**: ``const rssUrl = `https://brunch.co.kr/rss/@@${authorId}` `` — `@` 하나 추가
- **더블체크**: 실제 브런치 RSS URL 포맷 확인 (`@username` vs `@@username`)

### M11. `validateRSSFeed` Content-Type 제한
- **파일**: `lib/crawlers/strategy-resolver.ts` ~1045행
- **현상**: `text/html`로 서빙되는 유효한 RSS 피드 거부
- **수정 방향**: Content-Type 체크 완화 또는 body 내용 기반 판단 우선
- **더블체크**: 실제 RSS인데 `text/html`로 서빙되는 사례 확인

### M12. 비-Cheerio 전략 0건 시 early return
- **파일**: `lib/crawlers/index.ts` ~422행
- **현상**: RSS/API 전략이 0건 반환 + 마지막 전략 아닐 때 → `return []`로 fallback 스킵
- **영향**: RSS 피드 URL 무효화 시 STATIC fallback 시도 불가
- **더블체크**: 이 early return 조건의 의도 확인 (정상 0건 vs 에러 0건 구분 필요)

---

## LOW — 개선 권장

### L1. `isCrawlConfig` 타입 가드 과도하게 허용
- **파일**: `lib/crawlers/types.ts` ~165행
- **현상**: `typeof config === 'object' && config !== null` → 배열도 통과
- **더블체크**: DB에서 config가 배열로 저장되는 케이스가 있는지 확인

### L2. `normalizeUrl` — origin 기준 resolve
- **파일**: `lib/crawlers/url-optimizer.ts` ~397행, `strategy-resolver.ts` ~1119행
- **현상**: `new URL(href, base.origin)` — 경로 기준이 아닌 origin 기준으로 상대 URL 해석
- **영향**: `/blog/page1`에서 상대 경로 `articles` → `/articles` (예상: `/blog/articles`)

### L3. DD.MM.YYYY vs YYYY.MM.DD 파싱 순서
- **파일**: `lib/crawlers/date-parser.ts` ~287행
- **현상**: YYYY.MM.DD 패턴이 먼저 매칭 → `15.03.2024` 같은 유럽식 날짜 오파싱
- **더블체크**: 실제 크롤링 대상 사이트에서 DD.MM.YYYY 형식 사용 여부 확인

### L4. 레거시 `base.ts` date 함수 미정리
- **파일**: `lib/crawlers/base.ts`
- **현상**: `date-parser.ts` 도입 후에도 `base.ts`에 열등한 `parseDate`/`isWithinDays` 잔존
- **관련**: H3과 연결 — sitemap이 이 열등한 버전 사용 중

### L5. config 읽기-쓰기 비원자적
- **파일**: `lib/crawlers/index.ts` ~955행
- **현상**: config를 DB에서 읽고 → 수정 → 다시 쓰는 사이에 다른 병렬 크롤러가 config 변경 가능
- **영향**: auto-detection 결과나 URL 해시가 덮어써질 수 있음
- **더블체크**: 실제 병렬 실행 시 같은 소스의 config를 동시에 수정하는 시나리오가 가능한지 확인

---

## 이미 수정된 항목

### [수정완료] RSS 스코프 체크 — Google News RSS 거부
- **파일**: `lib/crawlers/strategies/rss.ts` ~40행
- **현상**: URL 최적화로 설정된 `crawl_config.rssUrl`이 스코프 체크에서 거부됨
- **수정**: `explicitRssUrl`(config에 명시된 RSS)은 스코프 체크 건너뛰도록 변경
- **수정일**: 2026-03-07
