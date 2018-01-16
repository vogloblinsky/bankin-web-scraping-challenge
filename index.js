const puppeteer = require('puppeteer'),
      URL = 'http://localhost/RetD/bankin-web-scraping-challenge/original-src/', // 'https://web.bankin.com/challenge/index.html'
      MAX_PAGINATION = 5000,
      PAGINATION_INCREMENT = 50;

async function run() {

    let startTime = (new Date()).getTime();

    const browser = await puppeteer.launch({
        headless: true
    });

    const page = await browser.newPage();

    page.on('dialog', async dialog => {
        console.log(dialog.message());
        await dialog.dismiss();
    });

    await page.goto(URL, {
        waitUntil : 'domcontentloaded'
    });

    const result = await page.evaluate('doGenerate()');
    console.log(result);

    await page.waitFor('#dvTable');

    let dvTableElements = await page.evaluate((sel) => {
        return document.querySelectorAll(sel);
    }, '#dvTable tr');

    console.log(dvTableElements);

    let finalTime = (new Date()).getTime();

    console.log(`Scraping done in ${Math.floor((finalTime - startTime) / 1000)} seconds`);

    //await page.waitFor('#dvTable');
    //await page.waitFor('#fm');

    browser.close();
}

run();