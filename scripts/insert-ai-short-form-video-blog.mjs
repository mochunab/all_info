// AI 숏폼 광고 영상 만들기 → 블로그 포스트 INSERT 스크립트
// Usage: node scripts/insert-ai-short-form-video-blog.mjs

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
<p>지난번에 <a href="/blog/ai-card-news-automation-guide-2026">AI 카드뉴스 자동화 가이드</a>를 공유했었죠? 10장짜리 카드뉴스를 10분 만에, 550원으로 만드는 그 글이요.</p>

<p>근데 글 올리고 나서 바로 느꼈어요. <strong>인스타 알고리즘이 이미지보다 릴스를 훨씬 많이 밀어준다는 걸요.</strong></p>

<p>같은 주제를 카드뉴스로 올렸을 때랑 15초 릴스로 올렸을 때, 도달 수가 3~5배 차이 나더라고요. 그래서 생각했습니다. "이미 만들어둔 카드뉴스를 영상으로 바꾸면 되는 거 아닌가?"</p>

<p>결론부터 말하면, <strong>됩니다.</strong> 거의 무료로요.</p>

<blockquote style="background:#e8f5e9;border-left:4px solid #4caf50;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>이 글을 읽으면 할 수 있는 것들:</strong><br/>
- 카드뉴스 이미지 → 움직이는 릴스 영상으로 변환<br/>
- AI 나레이션 + BGM 자동 합성<br/>
- 주제만 넣으면 숏폼 영상이 나오는 도구 활용<br/>
- 비용? <strong>거의 0원.</strong> 쓰는 도구가 전부 무료거든요.
</blockquote>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>카드뉴스는 만들었는데, 릴스는 어떡하지?</h2>

<p>카드뉴스 자동화까지 해놓으니까 욕심이 생기더라고요. "이걸 영상으로 만들면 훨씬 많은 사람한테 닿겠다"는 거죠.</p>

<p>근데 영상 제작이라고 하면 다들 이런 그림이 먼저 떠오르잖아요:</p>

<ul style="margin:12px 0;padding-left:24px;">
<li>프리미어 프로 깔기 → 용량 10GB</li>
<li>편집 배우기 → 유튜브 강의 3시간</li>
<li>외주 맡기기 → 견적서 100만원</li>
</ul>

<p>저도 그랬어요. 그런데 실제로 해보니까 <strong>카드뉴스 이미지가 이미 있으면 영상은 금방</strong>이에요. 이미지에 살짝 움직임 주고, AI 목소리 올리고, BGM 깔면 끝이거든요.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>전체 흐름부터 볼까요?</h2>

<p>두 가지 방법이 있어요. 상황에 맞게 골라 쓰시면 됩니다.</p>

<div style="background:#1e1e2e;border-radius:12px;padding:24px 20px;margin:16px 0;">
  <p style="color:#a6adc8;font-size:13px;font-weight:600;margin:0 0 16px 0;">방법 A: 카드뉴스 → 영상 변환</p>
  <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
    <div style="background:#313244;border-radius:8px;padding:14px 18px;text-align:center;min-width:110px;">
      <p style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0;">카드뉴스 이미지</p>
      <p style="color:#a6adc8;font-size:12px;margin:4px 0 0;">이미 만들어둔 것</p>
    </div>
    <span style="color:#6c7086;font-size:20px;align-self:center;">→</span>
    <div style="background:#313244;border-radius:8px;padding:14px 18px;text-align:center;min-width:100px;">
      <p style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0;">모션 추가</p>
      <p style="color:#a6adc8;font-size:12px;margin:4px 0 0;">Pika로<br/>살짝 움직임</p>
    </div>
    <span style="color:#6c7086;font-size:20px;align-self:center;">→</span>
    <div style="background:#313244;border-radius:8px;padding:14px 18px;text-align:center;min-width:100px;">
      <p style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0;">나레이션</p>
      <p style="color:#a6adc8;font-size:12px;margin:4px 0 0;">edge-tts<br/>(무료 AI 음성)</p>
    </div>
    <span style="color:#6c7086;font-size:20px;align-self:center;">→</span>
    <div style="background:#313244;border-radius:8px;padding:14px 18px;text-align:center;min-width:100px;">
      <p style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0;">조립</p>
      <p style="color:#a6adc8;font-size:12px;margin:4px 0 0;">ffmpeg로<br/>합치기</p>
    </div>
    <span style="color:#6c7086;font-size:20px;align-self:center;">→</span>
    <div style="background:#313244;border-radius:8px;padding:14px 18px;text-align:center;min-width:80px;">
      <p style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0;">완성!</p>
      <p style="color:#a6adc8;font-size:12px;margin:4px 0 0;">15~30초<br/>릴스</p>
    </div>
  </div>
</div>

<div style="background:#1e1e2e;border-radius:12px;padding:24px 20px;margin:16px 0;">
  <p style="color:#a6adc8;font-size:13px;font-weight:600;margin:0 0 16px 0;">방법 B: 주제만 넣으면 영상이 나오는 원클릭</p>
  <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
    <div style="background:#313244;border-radius:8px;padding:14px 18px;text-align:center;min-width:110px;">
      <p style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0;">주제 입력</p>
      <p style="color:#a6adc8;font-size:12px;margin:4px 0 0;">"직장인 부업<br/>트렌드 TOP5"</p>
    </div>
    <span style="color:#6c7086;font-size:20px;align-self:center;">→</span>
    <div style="background:#313244;border-radius:8px;padding:14px 18px;text-align:center;min-width:130px;">
      <p style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0;">AI가 알아서</p>
      <p style="color:#a6adc8;font-size:12px;margin:4px 0 0;">스크립트 + 이미지<br/>+ 나레이션 + 자막</p>
    </div>
    <span style="color:#6c7086;font-size:20px;align-self:center;">→</span>
    <div style="background:#313244;border-radius:8px;padding:14px 18px;text-align:center;min-width:80px;">
      <p style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0;">완성!</p>
      <p style="color:#a6adc8;font-size:12px;margin:4px 0 0;">숏폼 영상<br/>바로 출력</p>
    </div>
  </div>
</div>

<p>방법 A는 이미 카드뉴스 이미지가 있는 분한테 좋고, 방법 B는 이미지 없이 처음부터 영상을 뽑고 싶을 때 좋아요. 저는 둘 다 쓰고 있는데, 하나씩 설명해 드릴게요.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>방법 A: 카드뉴스에 숨결 불어넣기</h2>

<p>이미 만들어둔 카드뉴스 이미지가 있잖아요? 거기에 3가지만 얹으면 릴스가 됩니다.</p>

<h3>Step 1. 이미지에 모션 추가 — Pika</h3>

<p><a href="https://pika.art/" target="_blank" rel="noopener">Pika</a>는 정적 이미지를 넣으면 살짝 움직이는 영상 클립으로 바꿔주는 도구예요. 배경이 은은하게 흘러가거나, 빛이 반짝이는 정도의 미묘한 모션을 추가해줍니다.</p>

<p>"이게 왜 필요하냐"고요? 릴스에서 <strong>완전히 정지된 이미지는 알고리즘이 싫어해요.</strong> 아주 살짝만 움직여도 "영상"으로 인식돼서 도달 수가 확 올라갑니다.</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code># Pika에서 이미지 → 모션 영상 변환
# 웹 UI 기준 (API도 동일한 흐름)

1. pika.art 접속 → 이미지 업로드
2. 프롬프트 입력:
   "subtle background motion, gentle light particles
    floating upward, smooth and calm, 4 seconds"
3. Generate → 4초 클립 다운로드 (MP4)
</code></pre>

<blockquote style="background:#fff8e1;border-left:4px solid #ffc107;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>삽질 줄이는 팁:</strong> 모션 프롬프트에 "subtle", "gentle", "calm" 같은 단어를 꼭 넣어주세요. 안 그러면 배경이 용암처럼 흘러내리는 (...) 카오스가 펼쳐져요. 카드뉴스 위에 텍스트가 있으니까 배경만 살짝 움직이는 게 포인트예요.
</blockquote>

<p><strong>무료로 하고 싶다면?</strong> Pika 무료 크레딧이 매일 충전돼요. 하루에 3~5개 정도는 무료로 만들 수 있어서, 카드뉴스 10장을 2~3일에 걸쳐 변환하면 비용 0원입니다.</p>

<h3>Step 2. AI가 읽어주는 나레이션 — edge-tts</h3>

<p>카드뉴스에 있던 카피를 AI 목소리로 읽어주면 영상 느낌이 확 살아요. <strong>edge-tts</strong>는 Microsoft Edge 브라우저에 내장된 TTS(텍스트→음성) 엔진인데, 무료로 쓸 수 있어요.</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code># edge-tts 설치
pip install edge-tts

# 한국어 나레이션 생성 (여성 음성)
edge-tts --voice "ko-KR-SunHiNeural" \\
  --text "2026년, 직장인 부업 트렌드가 완전히 바뀌었어요." \\
  --write-media slide_1.mp3 \\
  --rate "+10%"

# 남성 음성도 가능
edge-tts --voice "ko-KR-InJoonNeural" \\
  --text "AI로 월 100만원 부수입, 정말 가능할까요?" \\
  --write-media slide_2.mp3</code></pre>

<p>슬라이드 10장 카피를 하나씩 MP3로 뽑으면 돼요. 한 줄이면 끝이라서 진짜 간단합니다.</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead><tr>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">음성</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">코드</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">느낌</th>
</tr></thead>
<tbody>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">SunHi (여성)</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:0.9em;">ko-KR-SunHiNeural</code></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">밝고 또렷한 톤. 정보 전달에 좋음</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">InJoon (남성)</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:0.9em;">ko-KR-InJoonNeural</code></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">차분하고 신뢰감 있는 톤</td>
</tr>
</tbody>
</table>

<blockquote style="background:#fff8e1;border-left:4px solid #ffc107;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>속도 조절이 핵심이에요.</strong> 기본 속도는 좀 느려서 <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:0.9em;">--rate "+10%"</code>를 넣어주는 게 좋아요. 릴스는 짧으니까 약간 빠른 게 자연스럽거든요. "+20%"까지는 괜찮은데, 그 이상은 로봇 같아져요.
</blockquote>

<h3>Step 3. 합치기 — ffmpeg 한 줄이면 끝</h3>

<p>모션 영상 + 나레이션 + BGM을 하나로 합치는 건 <strong>ffmpeg</strong>가 해줍니다. 영상 편집 프로그램 없이 터미널 명령어 한 줄이에요.</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code># 이미지(또는 모션 클립) + 나레이션 + BGM → 최종 릴스

# 1. 이미지 → 3초짜리 영상 클립으로 변환 (모션 없이 쓸 때)
ffmpeg -loop 1 -i slide_1.png -t 3 -vf "scale=1080:1920" \\
  -c:v libx264 -pix_fmt yuv420p clip_1.mp4

# 2. 10개 클립을 하나로 이어붙이기
# filelist.txt에 이렇게 적어두고:
#   file 'clip_1.mp4'
#   file 'clip_2.mp4'
#   ...
ffmpeg -f concat -safe 0 -i filelist.txt -c copy slideshow.mp4

# 3. 나레이션 합성
ffmpeg -i slideshow.mp4 -i narration.mp3 \\
  -c:v copy -c:a aac -map 0:v -map 1:a final.mp4

# 4. BGM까지 깔기 (나레이션 볼륨 유지, BGM은 20%로)
ffmpeg -i final.mp4 -i bgm.mp3 \\
  -filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.2[music];[voice][music]amix=inputs=2" \\
  -c:v copy output_reel.mp4</code></pre>

<p>길어 보이지만 복붙하면 돼요. 각 줄이 하는 일은:</p>

<ol style="margin:12px 0;padding-left:24px;">
<li>이미지를 영상 클립으로 변환 (슬라이드당 3초)</li>
<li>클립들을 순서대로 이어붙이기</li>
<li>AI 나레이션 올리기</li>
<li>BGM을 작게 깔기 (나레이션이 묻히지 않게)</li>
</ol>

<blockquote style="background:#e8f5e9;border-left:4px solid #4caf50;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>무료 BGM은 어디서?</strong><br/>
- <a href="https://pixabay.com/music/" target="_blank" rel="noopener">Pixabay Music</a> — 상업적 이용 무료, 저작권 걱정 없음<br/>
- YouTube Audio Library — 유튜브 스튜디오에서 다운 가능<br/>
- "lo-fi", "corporate", "upbeat" 검색하면 릴스에 어울리는 것들 바로 나와요
</blockquote>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>방법 B: 주제만 넣으면 영상이 뚝딱 — simple-shorts-generator</h2>

<p>"카드뉴스 이미지 없는데요?" 하는 분들, 걱정 마세요. 주제 하나만 던지면 스크립트 작성 → 이미지 생성 → 나레이션 → 자막 → 합성까지 한 번에 해주는 오픈소스가 있어요.</p>

<p><a href="https://github.com/Daewooki/simple-shorts-generator" target="_blank" rel="noopener">simple-shorts-generator</a>라는 건데, 이름 그대로예요. 진짜 심플해요.</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code># 설치 (Python 필요)
git clone https://github.com/Daewooki/simple-shorts-generator
cd simple-shorts-generator
pip install -r requirements.txt

# 실행 — 이게 끝이에요, 진짜로
python main.py --topic "2026년 직장인 부업 트렌드 TOP 5"</code></pre>

<p>이 한 줄을 실행하면 이런 일이 벌어져요:</p>

<ol style="margin:12px 0;padding-left:24px;">
<li>Gemini가 스크립트를 써요 (장면별 내레이션 + 이미지 프롬프트)</li>
<li>AI가 각 장면에 맞는 이미지를 생성해요</li>
<li>edge-tts가 스크립트를 읽어서 나레이션을 만들어요</li>
<li>자막이 자동으로 입혀져요</li>
<li>ffmpeg가 전부 합쳐서 MP4를 뽑아요</li>
</ol>

<p>1분도 안 걸려서 15~30초짜리 숏폼 영상이 output 폴더에 떨어져요. 처음 돌렸을 때 "이게 돼?" 하고 진짜 놀랐어요.</p>

<h3>내 브랜드에 맞게 커스터마이징</h3>

<p>기본 설정 그대로 써도 되지만, 브랜드 느낌을 살리려면 config를 좀 만져주는 게 좋아요:</p>

<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code># config 예시 (config.yaml 또는 프로젝트 설정 파일)

tts:
  voice: "ko-KR-SunHiNeural"    # 한국어 여성 음성
  rate: "+10%"                    # 약간 빠르게

subtitle:
  font: "NanumSquareRound"       # 자막 폰트
  color: "#FFFFFF"                # 자막 색상
  position: "bottom"              # 하단 배치

video:
  resolution: "1080x1920"        # 세로 9:16
  duration_per_scene: 3           # 장면당 3초
  fps: 30</code></pre>

<blockquote style="background:#fff8e1;border-left:4px solid #ffc107;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>자막 폰트가 중요해요.</strong> 기본 폰트는 영어 기준이라 한글이 예쁘게 안 나올 수 있어요. <strong>NanumSquareRound</strong>이나 <strong>Pretendard</strong> 같은 한글 폰트를 fonts 폴더에 넣어주면 훨씬 깔끔해집니다.
</blockquote>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>근데 뭘 만들어야 조회수가 나올까?</h2>

<p>도구는 알겠는데, 진짜 고민은 이거죠. <strong>"뭘 주제로 만들어야 사람들이 보냐?"</strong></p>

<p>저도 처음엔 감으로 주제를 잡았어요. "이거 재밌겠다" 싶은 걸로요. 근데 막상 올려보면 조회수 50, 30... 삽질이 반복됐습니다.</p>

<p>그러다 방법을 바꿨어요. <strong>요즘 사람들이 실제로 어떤 콘텐츠에 반응하는지 먼저 보고, 거기서 주제를 뽑는 거예요.</strong></p>

<p>저는 <a href="https://aca-info.com/ko?utm_source=blog&utm_medium=ai-short-form-ad-video-guide-2026&utm_campaign=ai-content" target="_blank" rel="noopener">아카인포</a>에서 매일 트렌드를 확인하고 있어요. 업계별 최신 콘텐츠가 AI로 자동 요약돼서 올라오거든요. 거기서 "이 주제 요즘 핫하네" 싶은 걸 골라서 숏폼 주제로 쓰면, 감이 아니라 데이터 기반으로 콘텐츠를 만들 수 있어요.</p>

<blockquote style="background:#e8f5e9;border-left:4px solid #4caf50;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
<strong>제가 쓰는 루틴:</strong><br/>
1. 아카인포에서 이번 주 인기 인사이트 훑기 (5분)<br/>
2. "이걸 15초 릴스로 만들면?" 하고 주제 3개 뽑기<br/>
3. simple-shorts-generator로 영상 3개 바로 제작 (3분)<br/>
4. 월/수/금 예약 게시<br/><br/>
주 3회 콘텐츠를 <strong>10분</strong>도 안 걸려서 만들어요.
</blockquote>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>올리기까지 자동화하고 싶다면</h2>

<p>영상 만드는 것까지 자동화했는데, 업로드는 직접 하면 좀 억울하잖아요. 여기도 자동화할 수 있어요.</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead><tr>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">플랫폼</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">자동 게시</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">방법</th>
</tr></thead>
<tbody>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">인스타 릴스</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">가능</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">Meta Graph API (비즈니스 계정 필요)</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">유튜브 숏츠</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">가능</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">YouTube Data API</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">틱톡</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">가능</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">TikTok Content Posting API</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">네이버 TV 클립</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">수동</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">API 미지원 (직접 업로드)</td>
</tr>
</tbody>
</table>

<p>카드뉴스 자동화 글에서 소개했던 <strong>n8n</strong>을 여기서도 쓸 수 있어요. 영상 렌더링 완료 → Google Drive 저장 → 릴스 자동 게시 → Slack 알림까지 한 번에 연결하면, 진짜 "손 안 대고 코 푸는" 수준이 됩니다.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>비용 정리 — 이게 진짜 거의 무료?</h2>

<p>제가 쓰고 있는 도구별 비용을 정리해봤어요:</p>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead><tr>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">도구</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">뭘 하는 건지</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">비용</th>
</tr></thead>
<tbody>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>simple-shorts-generator</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">주제 → 완성 영상 (올인원)</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>무료</strong></td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>edge-tts</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">AI 나레이션 (한국어 자연스러움)</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>무료</strong></td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>ffmpeg</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">영상 합성, 자막, BGM</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>무료</strong></td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>Pika</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">이미지 → 모션 클립</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">무료 크레딧 or ~$10/월</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>Gemini API</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">스크립트/주제 생성</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>무료 티어</strong></td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;" colspan="2"><strong>합계 (Pika 무료 범위 내)</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;"><strong>0원</strong></td>
</tr>
</tbody>
</table>

<p>영상 외주 맡기면 건당 30~100만원 하잖아요. 그걸 거의 무료로, 그것도 10분 만에 만들 수 있다는 게... 솔직히 아직도 신기해요.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>방법 A vs 방법 B, 뭘 먼저 하면 좋을까?</h2>

<table style="width:100%;border-collapse:collapse;margin:16px 0;">
<thead><tr>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">비교</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">방법 A (카드뉴스 변환)</th>
<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">방법 B (원클릭 생성)</th>
</tr></thead>
<tbody>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>필요한 것</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">이미 만든 카드뉴스 이미지</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">주제만 있으면 됨</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>소요 시간</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">~15분 (이미지 있을 때)</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">~1분 (진짜로)</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>퀄리티</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">높음 (브랜드 디자인 유지)</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">중간 (빠른 양산에 강함)</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>추천 용도</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">브랜드 릴스, 주력 콘텐츠</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">정보형 양산, 테스트용</td>
</tr>
<tr>
<td style="border:1px solid #e0e0e0;padding:10px 14px;"><strong>난이도</strong></td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">ffmpeg 명령어 복붙</td>
<td style="border:1px solid #e0e0e0;padding:10px 14px;">Python 설치 + 한 줄 실행</td>
</tr>
</tbody>
</table>

<p><strong>제 추천은요?</strong> 방법 B로 먼저 맛보세요. simple-shorts-generator 설치하고 한 번 돌려보면 "오, 이게 되네?" 하는 순간이 와요. 그 감각이 생기면 방법 A로 퀄리티를 올리는 건 자연스러워요.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h2>시작은 오늘, 완성은 천천히</h2>

<p>정리하면 이래요:</p>

<ol style="margin:12px 0;padding-left:24px;">
<li><strong>오늘 당장</strong>: <a href="https://github.com/Daewooki/simple-shorts-generator" target="_blank" rel="noopener">simple-shorts-generator</a> 설치 → 주제 하나 넣고 돌려보기</li>
<li><strong>이번 주</strong>: 나온 영상 릴스/틱톡에 올려보기 → 반응 확인</li>
<li><strong>다음 주</strong>: edge-tts + ffmpeg로 카드뉴스 영상 변환 시도</li>
<li><strong>여유 될 때</strong>: Pika 모션 추가, n8n 자동 게시 연결</li>
</ol>

<p>처음부터 전부 자동화할 필요 없어요. 저도 방법 B로 시작해서 지금은 주 3개 영상을 거의 손 안 대고 만들고 있거든요. 하나씩 붙여가다 보면 어느새 <strong>"주제만 던지면 릴스가 뚝딱"</strong> 나오는 시스템이 완성돼 있을 거예요.</p>

<p>카드뉴스도 영상도, 결국 도구 문제가 아니라 <strong>"뭘 만들 건지"</strong>가 핵심이에요. 트렌드를 읽는 눈만 있으면, 나머지는 AI가 다 해줍니다.</p>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<h3>이 시리즈의 다른 글</h3>
<ul style="margin:12px 0;padding-left:24px;">
<li><a href="/blog/ai-card-news-automation-guide-2026">AI 카드뉴스 자동 제작 가이드 — Gemini + Nano Banana 2 + n8n 완전 자동화</a></li>
<li><strong>AI 이미지 생성 실전 가이드</strong> — 곧 공개!</li>
<li><strong>AI 마케팅 자동화</strong> — 곧 공개!</li>
</ul>

<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />

<p>저는 이런 AI 자동화 삽질기를 <a href="https://aca-info.com/ko?utm_source=blog&utm_medium=ai-short-form-ad-video-guide-2026&utm_campaign=ai-content" target="_blank" rel="noopener">아카인포</a>에서 계속 공유하고 있어요. 콘텐츠 주제 찾기 어려우면 여기서 트렌드 먼저 체크해보세요!</p>
`;

async function main() {
  console.log('📝 AI 숏폼 광고 영상 가이드 블로그 포스트 INSERT...');

  await deletePost('ai-short-form-ad-video-guide-2026');

  await insertPost({
    slug: 'ai-short-form-ad-video-guide-2026',
    title: 'AI로 숏폼 광고 만들기 — 카드뉴스가 15초 릴스로 변하는 과정 (2026)',
    description: '카드뉴스 이미지를 릴스 영상으로 바꾸는 방법. edge-tts 무료 나레이션 + Pika 모션 + ffmpeg 합성. 주제만 넣으면 영상이 나오는 도구까지.',
    tags: ['AI영상제작', '숏폼광고', '릴스만들기', 'AI마케팅'],
    content,
  });

  console.log('\n🎉 완료! https://aca-info.com/ko/blog/ai-short-form-ad-video-guide-2026 에서 확인하세요.');
}

main().catch(console.error);
