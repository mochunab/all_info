// 실제 DB에 저장된 제목 확인 스크립트
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTitles() {
  const { data, error } = await supabase
    .from('articles')
    .select('title, source_name, source_url')
    .in('source_name', ['retailtalk', 'wiseapp', 'Wiseapp', 'Retailtalk'])
    .order('crawled_at', { ascending: false })
    .limit(15);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📋 실제 DB에 저장된 제목 샘플:\n');
  data?.forEach((article, i) => {
    console.log(`${i + 1}. [${article.source_name}] "${article.title}"`);
    if (article.source_url) {
      console.log(`   URL: ${article.source_url.substring(0, 80)}...`);
    }
    console.log('');
  });
}

checkTitles();
