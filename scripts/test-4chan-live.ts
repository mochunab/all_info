/**
 * 4chan 크롤러 실제 DB 저장 테스트 (Supabase 직접 연결)
 * npx tsx scripts/test-4chan-live.ts
 */

import { createClient } from '@supabase/supabase-js';
import { crawlFourchan } from '../lib/crypto/fourchan-crawler';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ .env.local에서 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🚀 4chan /biz/ 크롤러 라이브 테스트 (DB 저장)\n');

  const start = Date.now();
  const { results, completed } = await crawlFourchan(supabase, 120_000);

  for (const r of results) {
    console.log(`\n📊 결과:`);
    console.log(`  소스: ${r.source}`);
    console.log(`  채널: ${r.channel}`);
    console.log(`  발견: ${r.postsFound}건`);
    console.log(`  저장: ${r.postsNew}건`);
    console.log(`  멘션: ${r.mentionsExtracted}개`);
    if (r.errors.length > 0) {
      console.log(`  ❌ 에러: ${r.errors.join('; ')}`);
    }
  }

  // DB에서 방금 저장된 4chan 게시물 확인
  const { data: recent, error } = await supabase
    .from('crypto_posts')
    .select('id, source_id, title, score, posted_at')
    .eq('source', '4chan')
    .order('crawled_at', { ascending: false })
    .limit(5);

  if (error) {
    console.log(`\n❌ DB 조회 에러: ${error.message}`);
  } else if (recent && recent.length > 0) {
    console.log(`\n✅ DB에 저장된 최근 4chan 게시물:`);
    for (const p of recent) {
      console.log(`  [${p.source_id}] "${p.title.slice(0, 60)}..." (score: ${p.score})`);
    }
  } else {
    console.log('\n⚠️  DB에 4chan 게시물 없음');
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n⏱️  소요: ${elapsed}초, 완료: ${completed}\n`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
