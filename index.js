const puppeteer = require('puppeteer'),
      URL = 'http://localhost/TMP/bankin-web-scraping-challenge/original-src/', // 'https://web.bankin.com/challenge/index.html'
      MAX_PAGINATION = 5000,
      PAGINATION_INCREMENT = 50,
      DATA = [],
      ITERATOR = [];

for (let i = 0; i < 2; i++) {
    ITERATOR.push(i * 50);
}

console.log(ITERATOR);

async function run() {

    let startTime = (new Date()).getTime();

    const browserPromise = await puppeteer.launch({
        headless: false
    });

    async function scrapPage(iteration) {

        const browser = await browserPromise;

        const page = await browser.newPage();

        page.on('dialog', async dialog => {
            console.log('> dialog');        
            await dialog.dismiss();
            await page.click('#btnGenerate');
        });

        await page.goto(`${URL}?start=${iteration}`, {
            waitUntil : 'domcontentloaded'
        });
    
        const watchDog = page.waitForFunction(`(Object.keys(document.querySelectorAll('#dvTable tr')).length > 0) || (document.getElementById('fm') !== null && Object.keys(document.getElementById('fm').contentWindow.document.body.querySelectorAll('table tr')).length > 0)`, {
            polling: 10
        });
    
        await watchDog;
    
        let dvTableElements = await page.evaluate((sel) => {
            return document.querySelectorAll(sel);
        }, '#dvTable tr');
    
        console.log('dvTableElements: ', Object.keys(dvTableElements).length);

        if (Object.keys(dvTableElements).length > 0) {
            delete dvTableElements[0];
            DATA.push({
                iteration: iteration,
                data: dvTableElements
            });
        }
    
        // TODO virer element 1
    
        let dvIframeTableElements = await page.evaluate(() => {
            let result = [];
            if (document.getElementById('fm')) {
                result = document.getElementById('fm').contentWindow.document.body.querySelectorAll('table tr');
            }
            return result;
        });
    
        console.log('dvIframeTableElements: ', Object.keys(dvIframeTableElements).length);

        if (Object.keys(dvIframeTableElements).length > 0) {
            delete dvIframeTableElements[0];
            DATA.push({
                iteration: iteration,
                data: dvIframeTableElements
            });
        }
    }   

    async function processPages(iterations) {
        const promises = iterations.map(scrapPage);
        await Promise.all(promises);

        let finalTime = (new Date()).getTime();

        console.log(DATA);        

        console.log(`Scraping done in ${Math.floor((finalTime - startTime))} mseconds`); // /1000 seconds

        //browserPromise.close();
    }

    processPages(ITERATOR);
}

run();