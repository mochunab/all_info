// Run migration script
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rcjusbvzoezyyxjozzyo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Checking migration status...');

  // Test if columns exist by trying to select them
  const { data, error } = await supabase
    .from('articles')
    .select('id, ai_summary, summary_tags')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
    console.log('\nPlease run the following SQL in Supabase Dashboard SQL Editor:');
    const ref = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1] || '';
    console.log(`https://supabase.com/dashboard/project/${ref}/sql/new`);
    console.log(`
---------------------------------------------------
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS summary_tags TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name, is_default) VALUES
  ('비즈니스', TRUE),
  ('소비 트렌드', TRUE)
ON CONFLICT (name) DO NOTHING;
---------------------------------------------------
    `);
  } else {
    console.log('Articles table columns OK:', Object.keys(data[0] || {}));
  }

  // Try to check categories table
  const { data: catData, error: catError } = await supabase
    .from('categories')
    .select('*')
    .limit(5);

  if (catError) {
    console.log('\nCategories table not found or error:', catError.message);
  } else {
    console.log('Categories table OK:', catData);
  }
}

runMigration().catch(console.error);
