// AI 카드뉴스 자동화 가이드 → 블로그 포스트 INSERT 스크립트
// Usage: node scripts/insert-ai-card-news-blog.mjs

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const NOW = new Date().toISOString();

async function deletePost(slug) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${slug}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (res.ok) console.log(`🗑️  ${slug} 삭제 완료`);
}

async function insertPost(post) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      slug: post.slug,
      title: post.title,
      description: post.description,
      content: post.content,
      tags: post.tags,
      category: post.category || 'ai',
      published: true,
      published_at: NOW,
      language: 'ko',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ ${post.slug}: ${err}`);
    return;
  }

  const [data] = await res.json();
  console.log(`✅ ${post.slug} → id: ${data.id}`);
}

const content = `
<h2>카드뉴스 10장 만드는 데 3시간, 저만 힘들었던 건가요?</h2>

<p>저는 아카인포라는 서비스를 운영하면서 인스타그램 카드뉴스를 직접 만들어왔어요. 주제 정하고, 카피 쓰고, Canva에서 디자인하고, 이미지 찾고, 텍스트 배치하고… 10장짜리 카드뉴스 하나 만드는 데 매번 <strong>2~3시간</strong>이 걸리더라고요.</p>

<p>어느 날 문득 이런 생각이 들었습니다. "AI로 코드도 짜고 서비스도 만드는데, 카드뉴스도 자동으로 만들 수 있지 않을까?"</p>

<p>결론부터 말하면, <strong>됩니다.</strong> 그것도 아주 잘요.</p>

<blockquote style="background:#e8f5e9;border-left:4px solid #4caf50;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>제가 실제로 달라진 것들:</strong><br/>
- 카드뉴스 제작 시간: 2~3시간 → <strong>10분</strong><br/>
- 비용: 10장 기준 <strong>약 550원</strong> (커피 한 잔의 1/10)<br/>
- 코딩? <strong>몰라도 됩니다.</strong> n8n이라는 노코드 도구로 다 연결했어요.
</blockquote>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>전체 흐름부터 보고 가죠</h2>

<p>복잡하게 느껴질 수 있지만, 사실 4단계뿐이에요. 하나씩 붙여나가면 됩니다.</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code>┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. 기획     │    │  2. 이미지   │    │  3. 조립     │    │  4. 배포     │
│  "주제만     │ →  │  AI가 알아서 │ →  │  텍스트 +    │ →  │  인스타에    │
│   던지면"    │    │  그려줌      │    │  이미지 합체 │    │  자동 업로드 │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
</code></pre>

<p>전부 따로따로 써도 되고, n8n으로 연결하면 <strong>"주제 하나 입력 → 10장 완성 → 인스타 자동 업로드"</strong>까지 원클릭이에요. 진짜 마법 같죠.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>쓸 도구는 딱 3개면 끝</h2>

<p>제가 여러 조합을 써보고 결국 정착한 세팅이에요.</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead><tr>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">도구</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">뭘 하는 건지</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">비용</th>
</tr></thead>
<tbody>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>Gemini 2.5 Flash</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">카피를 써줘요. 슬라이드 구조까지 JSON으로 뚝딱.</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">무료 티어로 충분</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>Nano Banana 2</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">배경 이미지를 만들어줘요. 한국어 텍스트도 선명하게!</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">~$0.04/장</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>n8n</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">위 두 개를 연결해주는 자동화 엔진. 레고 조립하듯이.</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">셀프호스팅 무료</td>
</tr>
</tbody>
</table>

<blockquote style="background:#fff8e1;border-left:4px solid #ffc107;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>왜 이 조합이냐고요?</strong><br/>
Gemini Flash로 카피 쓰고, Nano Banana 2로 이미지 만드는데 — 이 두 개가 <strong>같은 Google API 키 하나</strong>로 동작해요. 계정 관리가 정말 편하거든요. ChatGPT + DALL-E + Zapier 조합도 써봤는데, 비용이 10배 이상 나왔습니다.
</blockquote>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>1단계: AI한테 기획을 맡기자</h2>

<p>카드뉴스에서 제일 오래 걸리는 게 뭔지 아세요? 디자인이 아니라 <strong>기획</strong>이에요. "몇 장으로 할까, 각 장에 뭘 넣을까, 카피는 어떻게 쓸까" — 이 고민을 Gemini한테 넘기면 됩니다.</p>

<p>제가 쓰는 프롬프트를 그대로 공유할게요:</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code>const prompt = \`
당신은 인스타그램 카드뉴스 기획 전문가입니다.

주제: "\${topic}"

다음 JSON 형식으로 10장짜리 카드뉴스 슬라이드를 기획해주세요:

{
  "title": "카드뉴스 제목",
  "slides": [
    {
      "slide_number": 1,
      "type": "cover",
      "headline": "후킹 제목 (15자 이내)",
      "subtext": "부제목 (20자 이내)",
      "image_prompt": "배경 이미지 프롬프트 (영문)",
      "color_scheme": "#hex 메인 컬러"
    },
    {
      "slide_number": 2,
      "type": "content",
      "headline": "핵심 메시지",
      "body": "본문 텍스트 (50자 이내)",
      "image_prompt": "배경 이미지 프롬프트 (영문)",
      "color_scheme": "#hex"
    }
  ]
}

규칙:
- 1장: 커버 (후킹 제목)
- 2~9장: 본문 (핵심 정보, 숫자/통계 활용)
- 10장: CTA (행동 유도)
- 각 슬라이드의 image_prompt는 텍스트 없는 배경 이미지용
- 한국어 카피, image_prompt만 영문
\`;
</code></pre>

<p>이걸 Gemini API에 넘기면요:</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code>import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateSlideStructure(topic) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

const slides = await generateSlideStructure("2026년 직장인 부업 트렌드 TOP 5");
</code></pre>

<p>5초도 안 걸려서 10장 분량의 카피가 JSON으로 쏟아져 나와요. 이전에 1시간 넘게 고민했던 게 바보처럼 느껴지더라고요.</p>

<blockquote style="background:#fff8e1;border-left:4px solid #ffc107;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>삽질 줄이는 팁:</strong> <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:0.9em;">responseMimeType: "application/json"</code> 이 한 줄이 핵심이에요. 이걸 안 넣으면 Gemini가 마크다운이랑 JSON을 섞어서 줘서 파싱이 꼬입니다. 저도 처음에 여기서 삽질 좀 했어요.
</blockquote>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>2단계: 이미지? AI가 그려줍니다</h2>

<p>1단계에서 각 슬라이드마다 <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:0.9em;">image_prompt</code>가 같이 나왔잖아요? 이걸 <strong>Nano Banana 2</strong>한테 그대로 넘기면 배경 이미지가 뚝딱 나옵니다.</p>

<p>Nano Banana 2는 Google이 올해 새로 출시한 이미지 생성 모델인데요, Gemini API 안에 들어있어서 별도 가입 없이 바로 쓸 수 있어요.</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code>import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateImage(prompt, outputPath) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: prompt,
    config: {
      responseModalities: ["image", "text"],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const imageBytes = part.inlineData.data;
      fs.writeFileSync(outputPath, Buffer.from(imageBytes, "base64"));
      console.log(\`✅ 이미지 저장: \${outputPath}\`);
      break;
    }
  }
}

// 10장 한꺼번에 생성
for (const slide of slides) {
  await generateImage(
    slide.image_prompt + ", no text, no letters",
    \`./output/slide_\${slide.slide_number}.png\`
  );
}
</code></pre>

<p>제가 제일 좋았던 건, <strong>한국어 텍스트 렌더링</strong>이 깔끔하다는 거예요. 예전 Imagen 모델은 한글 넣으면 깨지거나 이상하게 나왔는데, Nano Banana 2는 로고나 포스터에 한글 넣어도 잘 나옵니다.</p>

<h3>프롬프트 쓸 때 알아두면 좋은 것들</h3>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead><tr>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">용도</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">이렇게 써보세요</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">비율</th>
</tr></thead>
<tbody>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">인스타 피드</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">Minimal gradient background, soft blue to purple, abstract shapes, no text</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">1:1</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">스토리/릴스</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">Vertical gradient, warm coral tones, subtle bokeh, clean and modern</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">9:16</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">블로그 썸네일</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">Professional flat illustration, workspace with laptop, pastel colors</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">16:9</td>
</tr>
</tbody>
</table>

<blockquote style="background:#fff8e1;border-left:4px solid #ffc107;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>이거 하나만 기억하세요:</strong> 배경 이미지 프롬프트에 <strong>"no text, no letters, no words"</strong>를 꼭 넣어주세요. 안 그러면 AI가 이미지 안에 이상한 영어를 넣어버려요. 텍스트는 나중에 따로 올릴 거니까요.
</blockquote>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>3단계: 이미지 + 텍스트 = 카드뉴스 완성</h2>

<p>배경 이미지 위에 텍스트를 올려서 최종 카드뉴스를 만드는 단계예요. 여기서 두 갈래로 나뉩니다.</p>

<h3>코드 좀 다루는 분: HTML 템플릿 + Puppeteer</h3>

<p>n8n에서 HTML 템플릿을 렌더링하고 Puppeteer로 스크린샷을 찍으면 깔끔한 PNG가 나와요. 제가 쓰는 템플릿을 공유할게요:</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code>&lt;div style="
  width: 1080px;
  height: 1080px;
  position: relative;
  overflow: hidden;
"&gt;
  &lt;img src="{{backgroundUrl}}" style="
    width: 100%; height: 100%;
    object-fit: cover; position: absolute;
  " /&gt;

  &lt;!-- 글씨가 잘 보이게 반투명 오버레이 --&gt;
  &lt;div style="
    position: absolute; inset: 0;
    background: linear-gradient(
      180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%
    );
  "&gt;&lt;/div&gt;

  &lt;div style="
    position: absolute; bottom: 80px;
    left: 60px; right: 60px; color: white;
  "&gt;
    &lt;h1 style="font-size: 48px; font-weight: 800;"&gt;
      {{headline}}
    &lt;/h1&gt;
    &lt;p style="font-size: 24px; margin-top: 16px; opacity: 0.9;"&gt;
      {{body}}
    &lt;/p&gt;
  &lt;/div&gt;
&lt;/div&gt;
</code></pre>

<h3>코드가 싫은 분: Canva Bulk Create</h3>

<p>코드 한 줄도 안 건드리고 싶다면 Canva의 <strong>Bulk Create</strong> 기능을 쓰면 돼요:</p>

<ol style="margin:12px 0;padding-left:24px;">
<li>Canva에서 예쁜 템플릿 하나 잡고</li>
<li>텍스트 자리에 데이터 필드 연결해두고</li>
<li>1단계에서 나온 JSON을 CSV로 변환해서 업로드</li>
<li>"Generate" 누르면 10장 한꺼번에 완성!</li>
</ol>

<p>다만, Canva는 자동 업로드까지는 안 되니까 주 1회 이상 만드실 거라면 Puppeteer 방식을 추천해요.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>4단계: 만들었으면 올려야죠 — 자동으로</h2>

<p>여기까지 했으면 이제 인스타그램에 올리는 것도 자동화할 수 있어요. Instagram Graph API를 n8n에 연결하면 됩니다.</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code>// 캐러셀(여러 장) 포스팅 흐름

// 1. 각 슬라이드를 공개 URL에 업로드 (Google Drive or S3)
// 2. 캐러셀 컨테이너 생성
POST https://graph.facebook.com/v21.0/{ig-user-id}/media
  → image_url, caption, media_type: "CAROUSEL_ALBUM"

// 3. 슬라이드 2~10장 추가
POST .../media → is_carousel_item: true

// 4. 발행!
POST .../media_publish → creation_id: "{컨테이너 ID}"
</code></pre>

<p>저는 Google Drive에도 자동 저장되게 해뒀어요. 팀원한테 공유 드라이브 링크 보내서 "이거 올려도 될까요?" 하고 확인받는 것도 n8n으로 자동화할 수 있거든요.</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code>최종 워크플로우:

┌──────────┐   ┌──────┐   ┌────────┐   ┌──────┐   ┌──────────────┐
│ 매주 월요일│ → │ 기획 │ → │ 이미지 │ → │ 조립 │ → │ 자동 배포    │
│ 자동 실행  │   │      │   │        │   │      │   │ ├─ Instagram │
└──────────┘   └──────┘   └────────┘   └──────┘   │ ├─ Drive     │
                                                    │ └─ Slack알림 │
                                                    └──────────────┘
</code></pre>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>그래서 얼마나 절약되는 건데?</h2>

<p>카드뉴스 10장 1세트 기준으로 정리해봤어요:</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead><tr>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">뭘 하는지</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">뭘 쓰는지</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">10장 비용</th>
</tr></thead>
<tbody>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">카피 생성</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">Gemini 2.5 Flash</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>$0</strong> (무료 티어)</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">이미지 생성</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">Nano Banana 2</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>~$0.40</strong></td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">자동화</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">n8n 셀프호스팅</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>$0</strong></td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;" colspan="2"><strong>합계</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;"><strong>약 550원</strong></td>
</tr>
</tbody>
</table>

<p>월 4세트(주 1회) 만들면 <strong>월 2,200원</strong>이에요. 디자이너한테 외주 주면 세트당 5~15만원 하잖아요. 99% 절감이라고 하면 좀 과장 같은데, 진짜 그렇습니다.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>다른 방법들이랑 비교하면?</h2>

<p>저도 처음부터 이 방식을 쓴 건 아니에요. Canva 수작업 → ChatGPT + Canva 반자동 → 지금 풀자동화 순서로 발전시켜왔거든요.</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead><tr>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">비교</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">수작업 (Canva)</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">반자동 (ChatGPT + Canva)</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">풀자동화 (Gemini + n8n)</th>
</tr></thead>
<tbody>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>시간</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">2~3시간</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">40~60분</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>10분</strong></td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>비용</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">내 시간만</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">ChatGPT $20 + Canva $13/월</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>~550원/세트</strong></td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>이미지</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">템플릿 뻔함</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">DALL-E (그럭저럭)</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>Nano Banana 2 (선명)</strong></td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>업로드</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">직접</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">직접</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>자동</strong></td>
</tr>
</tbody>
</table>

<p>처음부터 풀자동화 하려고 하면 부담스러울 수 있어요. 저도 1단계(카피 자동화)부터 시작해서 조금씩 붙여나갔거든요. 그러니까 겁먹지 마세요!</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>시작은 작게, 나중엔 자동으로</h2>

<blockquote style="border-left:4px solid #e0e0e0;padding:8px 16px;margin:12px 0;color:#555;"><em>처음부터 완벽하게 자동화할 필요 없어요.</em></blockquote>

<p>제가 추천하는 순서는 이래요:</p>

<ol style="margin:12px 0;padding-left:24px;">
<li><a href="https://aistudio.google.com/" target="_blank" rel="noopener">Google AI Studio</a>에서 API 키 하나 발급받기 (무료, 1분)</li>
<li>1단계 카피 생성 코드를 복붙해서 한번 돌려보기</li>
<li>"오, 되네?" 싶으면 Nano Banana 2로 이미지도 생성해보기</li>
<li>맛 들리면 n8n으로 전체 연결하기</li>
</ol>

<p>하나씩 붙여가다 보면 어느새 <strong>"주제만 던지면 카드뉴스가 뚝딱"</strong> 나오는 시스템이 완성돼 있을 거예요. 저도 그랬으니까요.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<p>저는 이런 AI 자동화 삽질기를 <a href="https://aca-info.com/ko?utm_source=blog&utm_medium=ai-card-news-automation-guide-2026&utm_campaign=ai-content" target="_blank" rel="noopener">아카인포</a>에서 계속 공유하고 있어요. 궁금한 게 있으면 놀러오세요!</p>
`;

async function main() {
  console.log('📝 AI 카드뉴스 자동화 가이드 블로그 포스트 INSERT...');

  await deletePost('ai-card-news-automation-guide-2026');

  await insertPost({
    slug: 'ai-card-news-automation-guide-2026',
    title: 'AI 카드뉴스 자동 제작 가이드 — Gemini + Nano Banana 2 + n8n 완전 자동화 (2026)',
    description: 'Gemini API 하나로 카피 생성부터 이미지 제작까지. n8n 워크플로우로 카드뉴스 제작을 완전 자동화하는 실전 가이드.',
    tags: ['AI카드뉴스', '카드뉴스자동화', 'NanoBanana2', 'n8n자동화'],
    content,
  });

  console.log('\n🎉 완료! https://aca-info.com/ko/blog/ai-card-news-automation-guide-2026 에서 확인하세요.');
}

main().catch(console.error);
