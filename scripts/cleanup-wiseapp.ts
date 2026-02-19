import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanup() {
  // UI 라벨 아티클 삭제
  const { data, error } = await supabase
    .from('articles')
    .delete()
    .eq('source_name', 'wiseapp')
    .in('title', [
      '서비스 문의',
      '인사이트',
      '와이즈리테일 순위',
      '와이즈앱 순위',
      '소매시장분석',
      '비교하기',
      '앱시장분석',
    ])
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n✅ ${data?.length || 0}개의 잘못된 wiseapp 아티클 삭제 완료\n`);
}

cleanup();
