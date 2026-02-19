import puppeteer from 'puppeteer-core';

async function analyzeDetails() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('https://www.wiseapp.co.kr/insight/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  const details = await page.evaluate(() => {
    const result: any = {
      insightCards: [],
      posts: [],
    };

    // .insight_card_list 내부 구조
    const cardList = document.querySelector('.insight_card_list');
    if (cardList) {
      const items = cardList.querySelectorAll('li');
      items.forEach((li, i) => {
        if (i < 5) {
          const title = li.querySelector('.insight_title')?.textContent?.trim();
          const link = li.querySelector('a')?.getAttribute('href');
          const date = li.querySelector('.insight_date, .date')?.textContent?.trim();

          result.insightCards.push({
            title,
            link,
            date,
            html: li.innerHTML.substring(0, 200),
          });
        }
      });
    }

    // .post 구조
    const posts = document.querySelectorAll('.post');
    posts.forEach((post, i) => {
      if (i < 3) {
        const title = post.querySelector('h1, h2, h3, .title, .insight_title')?.textContent?.trim();
        const link = post.querySelector('a')?.getAttribute('href');
        result.posts.push({ title, link });
      }
    });

    return result;
  });

  console.log('\n📦 .insight_card_list 구조:\n');
  if (details.insightCards.length === 0) {
    console.log('❌ .insight_card_list를 찾을 수 없습니다.\n');
  } else {
    details.insightCards.forEach((card: any, i: number) => {
      console.log(`${i + 1}. 제목: "${card.title}"`);
      console.log(`   링크: ${card.link}`);
      console.log(`   날짜: ${card.date}`);
      console.log(`   HTML 샘플: ${card.html}...\n`);
    });
  }

  console.log('\n📰 .post 구조:\n');
  if (details.posts.length === 0) {
    console.log('❌ .post를 찾을 수 없습니다.\n');
  } else {
    details.posts.forEach((post: any, i: number) => {
      console.log(`${i + 1}. 제목: "${post.title}"`);
      console.log(`   링크: ${post.link}\n`);
    });
  }

  await browser.close();
}

analyzeDetails().catch(console.error);
