import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: koPosts } = await supabase
  .from('blog_posts')
  .select('translation_group_id, category')
  .eq('language', 'ko')
  .not('category', 'is', null)
  .not('translation_group_id', 'is', null);

if (!koPosts || koPosts.length === 0) {
  console.log('No Korean posts with categories found');
  process.exit(0);
}

// Debug: check state
const { data: allPosts } = await supabase
  .from('blog_posts')
  .select('id, slug, language, category, translation_group_id, published')
  .order('language');
console.log('All blog posts:');
for (const p of allPosts || []) {
  console.log(`  [${p.language}] ${p.slug} | cat=${p.category} | group=${p.translation_group_id} | pub=${p.published}`);
}

let updated = 0;
for (const ko of koPosts) {
  const { data } = await supabase
    .from('blog_posts')
    .update({ category: ko.category })
    .eq('translation_group_id', ko.translation_group_id)
    .neq('language', 'ko')
    .neq('category', ko.category)
    .select('id');

  if (data && data.length > 0) {
    updated += data.length;
    console.log(`Updated ${data.length} posts for group ${ko.translation_group_id} → ${ko.category}`);
  }
}
console.log(`Total updated: ${updated}`);
