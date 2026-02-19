import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSources() {
  const { data, error } = await supabase
    .from('crawl_sources')
    .select('id, name, crawler_type, base_url')
    .in('name', ['retailtalk', 'wiseapp']);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📋 크롤링 소스:\n');
  data?.forEach((source) => {
    console.log(`  ${source.id}: ${source.name} (${source.crawler_type})`);
    console.log(`      ${source.base_url}`);
  });
}

getSources();
