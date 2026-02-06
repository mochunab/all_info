#!/usr/bin/env npx tsx
/**
 * 크롤러 CLI
 *
 * Usage:
 *   npm run crawl              # 모든 활성 소스 크롤링
 *   npm run crawl -- --source=1  # 특정 소스 ID만 크롤링
 *   npm run crawl -- --dry-run   # DB 저장 없이 테스트
 *   npm run crawl -- --verbose   # 상세 로그 출력
 *   npm run crawl -- --list      # 등록된 소스 목록 출력
 *
 * Environment:
 *   SUPABASE_URL          - Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_KEY  - Supabase Service Role Key (서버 전용)
 */

import { createClient } from '@supabase/supabase-js';
import { runAllCrawlers, runCrawlerById } from '../lib/crawlers';

// 환경변수 로드
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// CLI 옵션 파싱
function parseArgs(): {
  source?: string;
  dryRun: boolean;
  verbose: boolean;
  list: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const options = {
    source: undefined as string | undefined,
    dryRun: false,
    verbose: false,
    list: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--list' || arg === '-l') {
      options.list = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1];
    } else if (arg.startsWith('-s=')) {
      options.source = arg.split('=')[1];
    }
  }

  return options;
}

// 도움말 출력
function printHelp(): void {
  console.log(`
Insight Hub Crawler CLI

Usage:
  npm run crawl [options]

Options:
  --source=<id>, -s=<id>   특정 소스 ID만 크롤링
  --dry-run, -d            DB 저장 없이 테스트 실행
  --verbose, -v            상세 로그 출력
  --list, -l               등록된 소스 목록 출력
  --help, -h               도움말 출력

Examples:
  npm run crawl                      # 모든 활성 소스 크롤링
  npm run crawl -- --source=1        # 소스 ID 1만 크롤링
  npm run crawl -- --dry-run         # 테스트 실행
  npm run crawl -- -d -v             # 테스트 + 상세 로그
  npm run crawl -- --list            # 소스 목록 확인

Environment Variables:
  SUPABASE_URL              Supabase 프로젝트 URL
  SUPABASE_SERVICE_KEY      Service Role Key (서버 전용)
  `);
}

// 소스 목록 출력
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listSources(supabase: any): Promise<void> {
  console.log('\n등록된 크롤링 소스 목록:\n');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources, error } = await (supabase as any)
    .from('crawl_sources')
    .select('*')
    .order('priority', { ascending: false });

  if (error) {
    console.error('소스 목록 조회 실패:', error);
    return;
  }

  if (!sources || sources.length === 0) {
    console.log('등록된 소스가 없습니다.');
    return;
  }

  console.log('ID | Name                    | Type          | Active | Last Crawled');
  console.log('-'.repeat(80));

  for (const source of sources) {
    const active = source.is_active ? '✓' : '✗';
    const lastCrawled = source.last_crawled_at
      ? new Date(source.last_crawled_at).toLocaleString('ko-KR')
      : 'Never';
    const name = source.name.padEnd(23).substring(0, 23);
    const type = (source.crawler_type || 'auto').padEnd(13).substring(0, 13);

    console.log(`${source.id.toString().padStart(2)} | ${name} | ${type} | ${active}      | ${lastCrawled}`);
  }

  console.log('\n');
}

// 메인 실행
async function main(): Promise<void> {
  const options = parseArgs();

  // 도움말
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // 환경변수 확인
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    console.error('\nRequired environment variables:');
    console.error('  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
    console.error('  SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  // Supabase 클라이언트 생성
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY) as any;

  // 소스 목록
  if (options.list) {
    await listSources(supabase);
    process.exit(0);
  }

  console.log('\n===========================================');
  console.log('Insight Hub Crawler');
  console.log('===========================================');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Mode: ${options.dryRun ? 'Dry Run' : 'Production'}`);
  if (options.source) {
    console.log(`Source: ${options.source}`);
  }
  console.log('===========================================\n');

  try {
    if (options.source) {
      // 특정 소스만 크롤링
      const result = await runCrawlerById(options.source, supabase, {
        dryRun: options.dryRun,
        verbose: options.verbose,
      });

      if (!result) {
        console.error(`Source not found: ${options.source}`);
        process.exit(1);
      }

      if (result.errors.length > 0) {
        process.exit(1);
      }
    } else {
      // 모든 활성 소스 크롤링
      const results = await runAllCrawlers(supabase, {
        dryRun: options.dryRun,
        verbose: options.verbose,
      });

      // 에러가 있으면 exit code 1
      const hasErrors = results.some((r) => r.result.errors.length > 0);
      if (hasErrors) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
