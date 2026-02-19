import { processTitle } from '../lib/crawlers/title-cleaner';

const testTitles = [
  "서비스 문의",
  "인사이트",
  "와이즈리테일 순위",
  "와이즈앱 순위",
  "소매시장분석",
  "비교하기",
  "2024년 상반기 앱 순위 분석 보고서", // 유효한 제목
  "글로벌 리테일 순위 변화", // 유효한 제목
];

console.log('\n📋 Wiseapp UI 라벨 필터링 테스트:\n');

testTitles.forEach((title, i) => {
  const result = processTitle(title);
  const status = result ? '✅ 통과' : '❌ 걸러짐';
  console.log(`${i + 1}. "${title}"`);
  console.log(`   ${status}${result ? `: "${result}"` : ''}`);
  console.log('');
});
