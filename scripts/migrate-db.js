// Direct database migration script using Supabase Management API
const https = require('https');

const projectRef = 'rcjusbvzoezyyxjozzyo';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjanVzYnZ6b2V6eXl4am96enlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQzMDQ2NSwiZXhwIjoyMDgzMDA2NDY1fQ._wKGeMJb3l4WDkyWEsn2m6CjhhnQLRY0WV47YjHASjo';

const migrations = [
  {
    name: 'Add ai_summary column',
    sql: `ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_summary TEXT;`
  },
  {
    name: 'Add summary_tags column',
    sql: `ALTER TABLE articles ADD COLUMN IF NOT EXISTS summary_tags TEXT[] DEFAULT '{}';`
  },
  {
    name: 'Create categories table',
    sql: `CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`
  },
  {
    name: 'Insert default categories',
    sql: `INSERT INTO categories (name, is_default) VALUES
      ('비즈니스', TRUE),
      ('소비 트렌드', TRUE)
    ON CONFLICT (name) DO NOTHING;`
  }
];

function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: `${projectRef}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/query',
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runMigration() {
  console.log('Running migrations...\n');
  console.log('Note: The Supabase REST API does not support raw SQL execution.');
  console.log('Please run the following SQL manually in Supabase Dashboard:');
  console.log('https://supabase.com/dashboard/project/' + projectRef + '/sql/new\n');
  console.log('------- COPY SQL BELOW -------\n');

  for (const migration of migrations) {
    console.log(`-- ${migration.name}`);
    console.log(migration.sql);
    console.log('');
  }

  console.log('------- END SQL -------\n');
}

runMigration().catch(console.error);
