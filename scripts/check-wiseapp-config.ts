import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkConfig() {
  const { data, error } = await supabase
    .from('crawl_sources')
    .select('*')
    .eq('name', 'wiseapp')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📋 Wiseapp 크롤링 설정:\n');
  console.log('ID:', data.id);
  console.log('이름:', data.name);
  console.log('URL:', data.base_url);
  console.log('타입:', data.crawler_type);
  console.log('\nConfig:');
  console.log(JSON.stringify(data.config, null, 2));
}

checkConfig();
