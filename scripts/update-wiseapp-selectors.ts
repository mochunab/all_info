import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateSelectors() {
  const newConfig = {
    category: '비즈니스',
    selectors: {
      container: '.insight_card_list',
      item: 'li',
      title: '.insight_title',
      link: 'a',
    },
    crawl_config: {
      additionalWait: 3000, // JS 실행 대기
    },
  };

  const { data, error } = await supabase
    .from('crawl_sources')
    .update({ config: newConfig })
    .eq('name', 'wiseapp')
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n✅ Wiseapp 셀렉터 업데이트 완료!\n');
  console.log('새 설정:');
  console.log(JSON.stringify(newConfig, null, 2));
}

updateSelectors();
