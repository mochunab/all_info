#!/usr/bin/env npx tsx
/**
 * Backfill translations for existing categories.
 * - Default 6 categories: use hardcoded translations from i18n.ts
 * - Custom categories: translate via DeepL API
 *
 * Usage: npx tsx --env-file=.env.local scripts/backfill-category-translations.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const deeplKey = process.env.DEEPL_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const HARDCODED_TRANSLATIONS: Record<string, Record<string, string>> = {
  '비즈니스 인사이트': { en: 'Business Insights', vi: 'Insight Kinh doanh', zh: '商业洞察', ja: 'ビジネスインサイト' },
  '마케팅 인사이트': { en: 'Marketing Insights', vi: 'Insight Marketing', zh: '营销洞察', ja: 'マーケティングインサイト' },
  'IT 트렌드': { en: 'IT Trends', vi: 'Xu hướng IT', zh: 'IT趋势', ja: 'ITトレンド' },
  'Z세대 트렌드': { en: 'Gen Z Trends', vi: 'Xu hướng Gen Z', zh: 'Z世代趋势', ja: 'Z世代トレンド' },
  '취업 팁/커리어': { en: 'Career Tips', vi: 'Mẹo tìm việc', zh: '求职/职业', ja: 'キャリアヒント' },
  '리테일/커머스 트렌드': { en: 'Retail/Commerce Trends', vi: 'Xu hướng Bán lẻ', zh: '零售/电商趋势', ja: 'リテール/コマーストレンド' },
};

const DEEPL_TARGET_LANGS: Record<string, string> = {
  en: 'EN',
  vi: 'VI',
  zh: 'ZH',
  ja: 'JA',
};

async function translateViaDeepL(name: string): Promise<Record<string, string>> {
  if (!deeplKey) {
    console.warn('  DEEPL_API_KEY not set, skipping DeepL translation');
    return {};
  }

  const results = await Promise.allSettled(
    Object.entries(DEEPL_TARGET_LANGS).map(async ([lang, deeplLang]) => {
      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${deeplKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: [name], target_lang: deeplLang, source_lang: 'KO' }),
      });
      if (!response.ok) throw new Error(`DeepL ${response.status}`);
      const data = await response.json();
      return { lang, text: data.translations[0].text };
    })
  );

  const translations: Record<string, string> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      translations[result.value.lang] = result.value.text;
    }
  }
  return translations;
}

async function main() {
  console.log('Fetching all categories...');
  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, translations')
    .order('id');

  if (error) {
    console.error('Failed to fetch categories:', error);
    process.exit(1);
  }

  if (!categories || categories.length === 0) {
    console.log('No categories found.');
    return;
  }

  console.log(`Found ${categories.length} categories\n`);

  for (const cat of categories) {
    const existing = cat.translations as Record<string, string> | null;
    if (existing && Object.keys(existing).length >= 4) {
      console.log(`[SKIP] "${cat.name}" — already has translations`);
      continue;
    }

    let translations: Record<string, string>;

    if (HARDCODED_TRANSLATIONS[cat.name]) {
      translations = HARDCODED_TRANSLATIONS[cat.name];
      console.log(`[HARDCODED] "${cat.name}" → ${JSON.stringify(translations)}`);
    } else {
      console.log(`[DEEPL] Translating "${cat.name}"...`);
      translations = await translateViaDeepL(cat.name);
      if (Object.keys(translations).length === 0) {
        console.log(`  No translations obtained, skipping`);
        continue;
      }
      console.log(`  → ${JSON.stringify(translations)}`);
    }

    const { error: updateError } = await supabase
      .from('categories')
      .update({ translations })
      .eq('id', cat.id);

    if (updateError) {
      console.error(`  Failed to update: ${updateError.message}`);
    } else {
      console.log(`  Updated`);
    }
  }

  console.log('\nBackfill complete.');
}

main().catch(console.error);
