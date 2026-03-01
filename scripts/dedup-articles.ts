/**
 * 교차 소스 중복 아티클 정리 스크립트
 * 정규화된 제목 기준으로 중복 감지 → 오래된 것 유지, 나머지 삭제
 *
 * Usage: npx tsx scripts/dedup-articles.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dryRun = process.argv.includes('--dry-run');

function normalizeTitle(title: string): string {
  return title
    .replace(/\s*[|｜\-–—]\s*[^|｜\-–—]*$/, '')
    .replace(/[…]+|\.{3,}$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`교차 소스 중복 아티클 정리`);
  console.log(`모드: ${dryRun ? '🧪 Dry Run (삭제 안함)' : '🗑️  실제 삭제'}`);
  console.log(`${'='.repeat(60)}\n`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: articles, error } = await (supabase as any)
    .from('articles')
    .select('id, title, source_name, source_url, published_at, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('DB 조회 오류:', error);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log('아티클이 없습니다.');
    return;
  }

  console.log(`총 ${articles.length}개 아티클 분석 중...\n`);

  // 정규화 제목 기준 그룹핑
  const groups = new Map<string, typeof articles>();

  for (const article of articles) {
    const normalized = normalizeTitle(article.title);
    if (normalized.length < 10) continue;

    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(article);
  }

  // 중복 그룹 필터 (2개 이상)
  const duplicateGroups = [...groups.entries()].filter(([, group]) => group.length >= 2);

  if (duplicateGroups.length === 0) {
    console.log('✅ 중복 아티클이 없습니다.');
    return;
  }

  console.log(`🔍 ${duplicateGroups.length}개 중복 그룹 발견\n`);

  const toDelete: { id: number; title: string; source_name: string }[] = [];

  for (const [normalized, group] of duplicateGroups) {
    // created_at 기준 오름차순 정렬 (가장 오래된 것 유지)
    group.sort((a: { created_at: string }, b: { created_at: string }) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const keep = group[0];
    const removes = group.slice(1);

    console.log(`📋 "${normalized.substring(0, 50)}${normalized.length > 50 ? '...' : ''}"`);
    console.log(`   ✅ 유지: [${keep.source_name}] ${keep.title.substring(0, 50)}`);
    for (const r of removes) {
      console.log(`   🗑️  삭제: [${r.source_name}] ${r.title.substring(0, 50)}`);
      toDelete.push({ id: r.id, title: r.title, source_name: r.source_name });
    }
    console.log('');
  }

  console.log(`${'─'.repeat(60)}`);
  console.log(`삭제 대상: ${toDelete.length}개\n`);

  if (dryRun) {
    console.log('🧪 Dry Run 모드 — 실제 삭제하지 않았습니다.');
    console.log('   실제 삭제하려면: npx tsx scripts/dedup-articles.ts');
    return;
  }

  let deleted = 0;
  for (const item of toDelete) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delError } = await (supabase as any)
      .from('articles')
      .delete()
      .eq('id', item.id);

    if (delError) {
      console.error(`   ❌ 삭제 실패 (id=${item.id}): ${delError.message}`);
    } else {
      deleted++;
    }
  }

  console.log(`\n✅ 완료: ${deleted}/${toDelete.length}개 삭제됨`);
}

main().catch(console.error);
