import puppeteer from 'puppeteer-core';

async function analyzeWiseapp() {
  console.log('🚀 Puppeteer 시작...\n');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  console.log('📄 페이지 로딩 중...\n');
  await page.goto('https://www.wiseapp.co.kr/insight/', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // 추가 대기 (JS 실행 완료)
  await new Promise(r => setTimeout(r, 3000));

  console.log('🔍 페이지 구조 분석 중...\n');

  const analysis = await page.evaluate(() => {
    const result: any = {
      articles: [],
      allLinks: [],
    };

    // 모든 링크 수집 (현재 셀렉터로 수집되는 것)
    const allLis = document.querySelectorAll('li');
    allLis.forEach((li, i) => {
      const a = li.querySelector('a');
      if (a && i < 20) { // 처음 20개만
        result.allLinks.push({
          text: a.textContent?.trim().substring(0, 50),
          href: a.getAttribute('href')?.substring(0, 80),
          classes: li.className,
        });
      }
    });

    // 실제 아티클로 보이는 요소들 찾기
    const possibleArticles = document.querySelectorAll(
      'article, .article, .post, .card, .insight-item, [class*="insight"], [class*="article"]'
    );

    possibleArticles.forEach((el, i) => {
      if (i < 10) {
        const title = el.querySelector('h1, h2, h3, h4, .title, .headline')?.textContent?.trim().substring(0, 60);
        const link = el.querySelector('a')?.getAttribute('href')?.substring(0, 80);
        result.articles.push({
          tagName: el.tagName,
          classes: el.className,
          title,
          link,
        });
      }
    });

    return result;
  });

  console.log('📋 현재 셀렉터로 수집되는 링크 (처음 20개):\n');
  analysis.allLinks.forEach((link: any, i: number) => {
    console.log(`${i + 1}. "${link.text}"`);
    console.log(`   href: ${link.href}`);
    console.log(`   class: ${link.classes}\n`);
  });

  console.log('\n🎯 실제 아티클로 보이는 요소들:\n');
  if (analysis.articles.length === 0) {
    console.log('❌ article 관련 요소를 찾을 수 없습니다.\n');
  } else {
    analysis.articles.forEach((article: any, i: number) => {
      console.log(`${i + 1}. <${article.tagName} class="${article.classes}">`);
      console.log(`   제목: ${article.title}`);
      console.log(`   링크: ${article.link}\n`);
    });
  }

  await browser.close();
}

analyzeWiseapp().catch(console.error);
