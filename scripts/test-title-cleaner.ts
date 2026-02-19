import { processTitle, cleanTitle, isTitleValid } from '../lib/crawlers/title-cleaner';

const testTitles = [
  "근린형 쇼핑몰 '스타필드 빌리지 운정'",
  "'넥스트 아시아 웨이브' 노리는 C-브랜드",
  "2026 물류시장 전망",
  "리테일톡 104호(2025년 12월 17일자)",
  "글로벌 소매업계의 연말 시즌전략",
  "유통업태별 2025년 결산 및 2026년 전망",
  "반려동물 시장 트렌드",
  "2026 핵심 소비트렌드 '압축소비'",
  // DB에서 발견된 문제 있는 제목
  "공지\n7 min read\n아마존의 식료품 혁신",
  "소매시장분석",
  "비교하기",
];

console.log('\n📋 제목 정제 테스트:\n');

testTitles.forEach((title, i) => {
  console.log(`${i + 1}. 원본: "${title.substring(0, 60)}..."`);
  const cleaned = cleanTitle(title);
  console.log(`   정제: "${cleaned}"`);
  const valid = isTitleValid(cleaned);
  console.log(`   유효: ${valid ? '✅' : '❌'}`);
  const final = processTitle(title);
  console.log(`   최종: ${final ? `"${final}"` : 'null (걸러짐)'}`);
  console.log('');
});
