// Run migration script
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rcjusbvzoezyyxjozzyo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjanVzYnZ6b2V6eXl4am96enlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQzMDQ2NSwiZXhwIjoyMDgzMDA2NDY1fQ._wKGeMJb3l4WDkyWEsn2m6CjhhnQLRY0WV47YjHASjo';

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
    console.log('https://supabase.com/dashboard/project/rcjusbvzoezyyxjozzyo/sql/new');
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
