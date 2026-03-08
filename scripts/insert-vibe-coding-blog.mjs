// 바이브코딩 가이드북 → 블로그 포스트 INSERT 스크립트
// 원본 노션 내용을 충실하게 변환하여 이미지 포함 업로드
// Usage: node scripts/insert-vibe-coding-blog.mjs

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const EXPORT_BASE = '/Users/hangyeol/Downloads/ExportBlock-70372d73-5b9d-47df-aa1c-b7a575ddff01-Part-1';
const GUIDE_DIR = join(EXPORT_BASE, '바이브코딩 가이드북 희망 편');
const TRACK_DIR = join(GUIDE_DIR, '실전 가이드 트랙별 맞춤 튜토리얼');
const STORAGE_BUCKET = 'blog-images';
const STORAGE_PATH = 'vibe-coding';
const NOW = new Date().toISOString();
const BLOG_BASE = '/ko/blog';

// ============================================================
// 1. 이미지 업로드
// ============================================================
async function uploadImage(localPath, storageName) {
  const fileData = readFileSync(localPath);
  const path = `${STORAGE_PATH}/${storageName}`;

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: fileData,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ❌ Upload failed: ${storageName}`, err);
    return null;
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
  console.log(`  ✅ ${storageName} → uploaded`);
  return publicUrl;
}

async function uploadAllImages() {
  const images = {};

  // Track A images
  const trackADir = join(TRACK_DIR, 'Track A 업무 자동화 - Claude Code 활용');
  images['track-a-terminal'] = await uploadImage(join(trackADir, 'image.png'), 'track-a-terminal.png');

  // Track B images
  const trackBDir = join(TRACK_DIR, 'Track B 사업 운영 도구 - Lovable 활용');
  images['track-b-lovable-home'] = await uploadImage(join(trackBDir, 'image.png'), 'track-b-lovable-home.png');
  images['track-b-cloud-btn'] = await uploadImage(join(trackBDir, 'image 1.png'), 'track-b-cloud-btn.png');
  images['track-b-enable-cloud'] = await uploadImage(join(trackBDir, 'image 2.png'), 'track-b-enable-cloud.png');
  images['track-b-publish'] = await uploadImage(join(trackBDir, 'image 3.png'), 'track-b-publish.png');
  images['track-b-permission'] = await uploadImage(join(trackBDir, 'dc557d33-74ad-4789-b082-fde41c69191f.png'), 'track-b-permission.png');
  images['track-b-cloud-dashboard'] = await uploadImage(join(trackBDir, 'a3e73339-fcf4-4886-b0f8-d3735d9e8f2c.png'), 'track-b-cloud-dashboard.png');

  // Track C images
  const trackCDir = join(TRACK_DIR, 'Track C 창업 아이템 구현 - Lovable + Claude Code');
  images['track-c-github-icon'] = await uploadImage(join(trackCDir, 'image.png'), 'track-c-github-icon.png');
  images['track-c-github-connect'] = await uploadImage(join(trackCDir, 'image 1.png'), 'track-c-github-connect.png');
  images['track-c-clone'] = await uploadImage(join(trackCDir, 'image 2.png'), 'track-c-clone.png');
  images['track-c-dns'] = await uploadImage(join(trackCDir, 'image 3.png'), 'track-c-dns.png');
  images['track-c-devtools'] = await uploadImage(join(trackCDir, '62d4e31c-bb8e-41f5-85c4-75255418a653.png'), 'track-c-devtools.png');

  return images;
}

// ============================================================
// 2. Markdown → HTML 변환 (간단한 수동 변환)
// ============================================================
function md2html(md, images = {}, imageMap = {}) {
  let html = md;

  // 이미지 참조를 실제 URL로 변환
  for (const [pattern, key] of Object.entries(imageMap)) {
    if (images[key]) {
      html = html.replace(
        new RegExp(`!\\[.*?\\]\\(${escapeRegex(pattern)}\\)`, 'g'),
        `<img src="${images[key]}" alt="" style="max-width:100%;border-radius:8px;margin:16px 0;" />`
      );
    }
  }

  // 나머지 이미지 참조 제거 (매핑 안 된 것)
  html = html.replace(/!\[.*?\]\(.*?\)/g, '');

  // Notion 내부 링크를 블로그 링크로 변환
  html = html.replace(/\[([^\]]+)\]\([^)]*Track%20A[^)]*\)/g, `<a href="${BLOG_BASE}/vibe-coding-track-a-claude-code">$1</a>`);
  html = html.replace(/\[([^\]]+)\]\([^)]*Track%20B[^)]*\)/g, `<a href="${BLOG_BASE}/vibe-coding-track-b-lovable">$1</a>`);
  html = html.replace(/\[([^\]]+)\]\([^)]*Track%20C[^)]*\)/g, `<a href="${BLOG_BASE}/vibe-coding-track-c-startup">$1</a>`);
  html = html.replace(/\[([^\]]+)\]\([^)]*%EB%B0%94%EC%9D%B4%EB%B8%8C%EC%BD%94%EB%94%A9.*?%EB%AD%94%EB%8D%B0[^)]*\)/g, `<a href="${BLOG_BASE}/vibe-coding-what-is-it">$1</a>`);
  html = html.replace(/\[([^\]]+)\]\([^)]*%ED%95%84%EC%88%98.*?%EC%A7%80%EC%8B%9D[^)]*\)/g, `<a href="${BLOG_BASE}/vibe-coding-essential-knowledge">$1</a>`);
  html = html.replace(/\[([^\]]+)\]\([^)]*%EA%B8%B0%ED%9A%8D.*?%EC%8B%9C%EC%9E%91[^)]*\)/g, `<a href="${BLOG_BASE}/vibe-coding-requirements-planning">$1</a>`);
  html = html.replace(/\[([^\]]+)\]\([^)]*%EC%8B%A4%EC%A0%84.*?%EA%B0%80%EC%9D%B4%EB%93%9C[^)]*\)/g, `<a href="${BLOG_BASE}/vibe-coding-practical-guide">$1</a>`);
  html = html.replace(/\[([^\]]+)\]\([^)]*Step%204.*?Node[^)]*\)/g, `<a href="${BLOG_BASE}/vibe-coding-track-a-claude-code">$1</a>`);

  // 외부 링크
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // 나머지 노션 내부 링크 정리
  html = html.replace(/\[([^\]]+)\]\([^)]*\.md\)/g, '$1');

  // 코드 블록
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;"><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // 인라인 코드
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:0.9em;">$1</code>');

  // 테이블
  html = html.replace(/(\|.+\|\n)+/g, (table) => {
    const rows = table.trim().split('\n');
    if (rows.length < 2) return table;

    let result = '<table style="width:100%;border-collapse:collapse;margin:16px 0;">';

    // Header row
    const headers = rows[0].split('|').filter(c => c.trim());
    result += '<thead><tr>';
    for (const h of headers) {
      result += `<th style="border:1px solid #e0e0e0;padding:10px 14px;background:#f5f5f5;text-align:left;font-weight:600;">${h.trim().replace(/\*\*/g, '')}</th>`;
    }
    result += '</tr></thead>';

    // Body rows (skip separator row)
    result += '<tbody>';
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.match(/^\|[\s\-:]+\|$/)) continue; // separator
      const cells = row.split('|').filter(c => c.trim() !== '' || c.includes(' '));
      if (cells.length === 0) continue;
      result += '<tr>';
      for (const c of cells) {
        const content = c.trim()
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/⭐|★/g, '★').replace(/☆/g, '☆');
        if (content) {
          result += `<td style="border:1px solid #e0e0e0;padding:10px 14px;">${content}</td>`;
        }
      }
      result += '</tr>';
    }
    result += '</tbody></table>';
    return result;
  });

  // Aside/callout
  html = html.replace(/<aside>\n?💡\n?\n?([\s\S]*?)<\/aside>/g,
    '<blockquote style="background:#fff8e1;border-left:4px solid #ffc107;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;"><strong>💡</strong> $1</blockquote>');
  html = html.replace(/<aside>\n?🎯\n?\n?([\s\S]*?)<\/aside>/g,
    '<blockquote style="background:#e8f5e9;border-left:4px solid #4caf50;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;"><strong>🎯</strong> $1</blockquote>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:4px solid #e0e0e0;padding:8px 16px;margin:12px 0;color:#555;">$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote[^>]*>/g, '<br/>');

  // Bold and italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/(^- .+\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map(l => {
      const content = l.replace(/^- /, '').trim();
      return `<li>${content}</li>`;
    }).join('');
    return `<ul style="margin:12px 0;padding-left:24px;">${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/(^\d+\. .+\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map(l => {
      const content = l.replace(/^\d+\. /, '').trim();
      return `<li>${content}</li>`;
    }).join('');
    return `<ol style="margin:12px 0;padding-left:24px;">${items}</ol>`;
  });

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />');

  // Plain URLs
  html = html.replace(/^(https?:\/\/[^\s<]+)$/gm, '<p><a href="$1" target="_blank" rel="noopener">$1</a></p>');

  // Paragraphs - wrap standalone text lines
  html = html.replace(/^(?!<[a-z/]|$)(.+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs and double newlines
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/\n{3,}/g, '\n\n');

  return html.trim();
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// 3. 블로그 포스트 INSERT
// ============================================================
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

// ============================================================
// 4. 메인 실행
// ============================================================
async function main() {
  console.log('============================================================');
  console.log('📸 이미지 업로드 중...');
  console.log('============================================================');

  const images = await uploadAllImages();

  console.log('\n============================================================');
  console.log('📝 블로그 포스트 생성 중...');
  console.log('============================================================\n');

  // --- 마크다운 파일 읽기 ---
  const mainMd = readFileSync(join(EXPORT_BASE, '바이브코딩 가이드북 희망 편 2f1e4c0b5e3280a4aa7bf03d35244722.md'), 'utf-8');
  const whatIsMd = readFileSync(join(GUIDE_DIR, '바이브코딩, 핫하던데 그래서 대체 그게 뭔데 2f1e4c0b5e3280beb55dc9f532ca829f.md'), 'utf-8');
  const knowledgeMd = readFileSync(join(GUIDE_DIR, '필수 지식 그래도 \'코딩\'인데 이 정도는 알아야 편하다! 2f1e4c0b5e3280ada6f0f52455629d4b.md'), 'utf-8');
  const planningMd = readFileSync(join(GUIDE_DIR, '기획 시작 요구사항 정의부터! 2f1e4c0b5e3280538710f84a4aa6dbd2.md'), 'utf-8');
  const trackAMd = readFileSync(join(TRACK_DIR, 'Track A 업무 자동화 - Claude Code 활용 2f1e4c0b5e32806f8e87e10b39f176b9.md'), 'utf-8');
  const trackBMd = readFileSync(join(TRACK_DIR, 'Track B 사업 운영 도구 - Lovable 활용 2f1e4c0b5e3280a3a0fccdc1354380d5.md'), 'utf-8');
  const trackCMd = readFileSync(join(TRACK_DIR, 'Track C 창업 아이템 구현 - Lovable + Claude Code 2f1e4c0b5e32804d92cbe17498e4cbac.md'), 'utf-8');

  // --- 포스트 정의 ---
  const posts = [
    {
      slug: 'vibe-coding-complete-guide-2026',
      title: '바이브코딩 완벽 가이드 2026 — 비개발자를 위한 AI 코딩 입문서',
      description: '바이브코딩으로 개발자 없이 서비스를 만드는 방법을 정리했습니다. AI 도구 비교, 필수 지식, 기획법, 실전 튜토리얼까지 비개발자를 위한 완벽 가이드입니다.',
      tags: ['바이브코딩', 'AI코딩', '노코드', '비개발자개발'],
      content: md2html(mainMd, images, {}),
    },
    {
      slug: 'vibe-coding-what-is-it',
      title: '바이브코딩이란? — 비개발자를 위한 AI 코딩 개념과 도구 비교',
      description: '바이브코딩의 정의, 핵심 원칙, Lovable vs Claude Code vs Cursor 도구 비교, 나에게 맞는 트랙 찾기까지 바이브코딩 입문에 필요한 모든 것을 정리했습니다.',
      tags: ['바이브코딩', 'Lovable', 'ClaudeCode', 'AI도구비교'],
      content: md2html(whatIsMd, images, {}),
    },
    {
      slug: 'vibe-coding-essential-knowledge',
      title: '바이브코딩 필수 지식 — 비개발자가 알아야 할 개발 용어 총정리',
      description: '프론트엔드, 백엔드, DB, API, GitHub 등 바이브코딩을 시작하기 전에 알아두면 편한 개발 개념들을 비개발자 눈높이로 쉽게 설명합니다.',
      tags: ['바이브코딩', '개발용어', '프론트엔드', '백엔드'],
      content: md2html(knowledgeMd, images, {}),
    },
    {
      slug: 'vibe-coding-requirements-planning',
      title: '바이브코딩 기획법 — 요구사항 정의 5단계 가이드',
      description: '바이브코딩에서 가장 중요한 기획 단계를 5단계로 정리했습니다. 문제 정의, 사용자 정의, 기능 목록, 화면 흐름, 데이터 정의까지 실전 예시와 템플릿을 제공합니다.',
      tags: ['바이브코딩', '기획', '요구사항정의', 'PM'],
      content: md2html(planningMd, images, {}),
    },
    {
      slug: 'vibe-coding-track-a-claude-code',
      title: 'Claude Code로 업무 자동화하기 — 바이브코딩 실전 Track A',
      description: 'Claude Code를 활용한 업무 자동화 튜토리얼입니다. 터미널 기초부터 Node.js 설치, Claude Code 설치, CS 문의 자동 분류 도구 만들기까지 45분 완성 가이드입니다.',
      tags: ['ClaudeCode', '업무자동화', '바이브코딩', '터미널'],
      content: md2html(trackAMd, images, {
        'Track%20A%20%EC%97%85%EB%AC%B4%20%EC%9E%90%EB%8F%99%ED%99%94%20-%20Claude%20Code%20%ED%99%9C%EC%9A%A9/image.png': 'track-a-terminal',
      }),
    },
    {
      slug: 'vibe-coding-track-b-lovable',
      title: 'Lovable로 예약 시스템 만들기 — 바이브코딩 실전 Track B',
      description: 'Lovable을 활용해 네일샵 예약 시스템을 45분 만에 만드는 튜토리얼입니다. AI 대화로 웹사이트 생성, 데이터베이스 연결, 배포까지 코딩 없이 완성합니다.',
      tags: ['Lovable', '예약시스템', '바이브코딩', '노코드'],
      content: md2html(trackBMd, images, {
        'Track%20B%20%EC%82%AC%EC%97%85%20%EC%9A%B4%EC%98%81%20%EB%8F%84%EA%B5%AC%20-%20Lovable%20%ED%99%9C%EC%9A%A9/image.png': 'track-b-lovable-home',
        'Track%20B%20%EC%82%AC%EC%97%85%20%EC%9A%B4%EC%98%81%20%EB%8F%84%EA%B5%AC%20-%20Lovable%20%ED%99%9C%EC%9A%A9/image%201.png': 'track-b-cloud-btn',
        'Track%20B%20%EC%82%AC%EC%97%85%20%EC%9A%B4%EC%98%81%20%EB%8F%84%EA%B5%AC%20-%20Lovable%20%ED%99%9C%EC%9A%A9/image%202.png': 'track-b-enable-cloud',
        'Track%20B%20%EC%82%AC%EC%97%85%20%EC%9A%B4%EC%98%81%20%EB%8F%84%EA%B5%AC%20-%20Lovable%20%ED%99%9C%EC%9A%A9/image%203.png': 'track-b-publish',
        'Track%20B%20%EC%82%AC%EC%97%85%20%EC%9A%B4%EC%98%81%20%EB%8F%84%EA%B5%AC%20-%20Lovable%20%ED%99%9C%EC%9A%A9/dc557d33-74ad-4789-b082-fde41c69191f.png': 'track-b-permission',
        'Track%20B%20%EC%82%AC%EC%97%85%20%EC%9A%B4%EC%98%81%20%EB%8F%84%EA%B5%AC%20-%20Lovable%20%ED%99%9C%EC%9A%A9/a3e73339-fcf4-4886-b0f8-d3735d9e8f2c.png': 'track-b-cloud-dashboard',
      }),
    },
    {
      slug: 'vibe-coding-track-c-startup',
      title: 'MVP 만들기 실전 가이드 — Lovable + Claude Code로 창업 아이템 구현 (Track C)',
      description: 'Lovable로 UI 디자인, Claude Code로 기능 구현, Supabase DB 연결, Vercel 배포, SEO, Google Analytics까지. 비개발자가 5-6시간 만에 MVP를 완성하는 전체 과정입니다.',
      tags: ['MVP', '창업', '바이브코딩', 'Supabase'],
      content: md2html(trackCMd, images, {
        'Track%20B%20%EC%82%AC%EC%97%85%20%EC%9A%B4%EC%98%81%20%EB%8F%84%EA%B5%AC%20-%20Lovable%20%ED%99%9C%EC%9A%A9/image.png': 'track-b-lovable-home',
        'Track%20A%20%EC%97%85%EB%AC%B4%20%EC%9E%90%EB%8F%99%ED%99%94%20-%20Claude%20Code%20%ED%99%9C%EC%9A%A9/image.png': 'track-a-terminal',
        'Track%20C%20%EC%B0%BD%EC%97%85%20%EC%95%84%EC%9D%B4%ED%85%9C%20%EA%B5%AC%ED%98%84%20-%20Lovable%20+%20Claude%20Code/image.png': 'track-c-github-icon',
        'Track%20C%20%EC%B0%BD%EC%97%85%20%EC%95%84%EC%9D%B4%ED%85%9C%20%EA%B5%AC%ED%98%84%20-%20Lovable%20+%20Claude%20Code/image%201.png': 'track-c-github-connect',
        'Track%20C%20%EC%B0%BD%EC%97%85%20%EC%95%84%EC%9D%B4%ED%85%9C%20%EA%B5%AC%ED%98%84%20-%20Lovable%20+%20Claude%20Code/image%202.png': 'track-c-clone',
        'Track%20C%20%EC%B0%BD%EC%97%85%20%EC%95%84%EC%9D%B4%ED%85%9C%20%EA%B5%AC%ED%98%84%20-%20Lovable%20+%20Claude%20Code/image%203.png': 'track-c-dns',
        'Track%20C%20%EC%B0%BD%EC%97%85%20%EC%95%84%EC%9D%B4%ED%85%9C%20%EA%B5%AC%ED%98%84%20-%20Lovable%20+%20Claude%20Code/62d4e31c-bb8e-41f5-85c4-75255418a653.png': 'track-c-devtools',
      }),
    },
  ];

  // --- INSERT ---
  for (const post of posts) {
    await insertPost(post);
  }

  console.log('\n============================================================');
  console.log('🎉 완료! https://aca-info.com/ko/blog 에서 확인하세요.');
  console.log('============================================================');
}

main().catch(console.error);
