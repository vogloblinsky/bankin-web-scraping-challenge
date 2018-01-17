const puppeteer = require('puppeteer'),
      URL = 'http://localhost/TMP/bankin-web-scraping-challenge/original-src/', // 'https://web.bankin.com/challenge/index.html'
      MAX_PAGINATION = 99,
      PAGINATION_INCREMENT = 50,
      DATA = [],
      ITERATOR = [];

for (let i = 0; i < MAX_PAGINATION; i++) {
    ITERATOR.push(i * PAGINATION_INCREMENT);
}

console.log(ITERATOR);

let extractDataFromLine = (line) => {
    return {
        Account: line.querySelectorAll('td')[0].innerHTML,
        Transaction: line.querySelectorAll('td')[1].innerHTML,
        Amount: line.querySelectorAll('td')[2].innerHTML.match(/\d+/g)[0],
        Currency: line.querySelectorAll('td')[2].innerHTML.match(/\D/g)[0]
    }
}

async function run() {

    let startTime = (new Date()).getTime();

    const browserPromise = await puppeteer.launch({
        headless: false
    });

    process.on("unhandledRejection", (reason, p) => {
        //console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
    });

    async function scrapPage(iteration) {

        const browser = await browserPromise;

        const page = await browser.newPage();

        page.on('dialog', dialog => {
            console.log('> dialog');        
            dialog.dismiss();
            page.click('#btnGenerate');
        });

        await page.goto(`${URL}?start=${iteration}`, {
            waitUntil : 'domcontentloaded'
        });
    
        const watchDog = page.waitForFunction(`(Object.keys(document.querySelectorAll('#dvTable tr')).length > 0) || (document.getElementById('fm') !== null && Object.keys(document.getElementById('fm').contentWindow.document.body.querySelectorAll('table tr')).length > 0)`, {
            polling: 10
        });
    
        await watchDog;
    
        let dvTableElements = await page.evaluate((sel) => {
            return [...document.querySelectorAll(sel)].splice(1).map(el => {
                return {
                    Account: el.querySelectorAll('td')[0].innerHTML,
                    Transaction: el.querySelectorAll('td')[1].innerHTML,
                    Amount: el.querySelectorAll('td')[2].innerHTML.match(/\d+/g)[0],
                    Currency: el.querySelectorAll('td')[2].innerHTML.match(/\D/g)[0]
                }
            });
        }, '#dvTable tr');
    
        console.log('dvTableElements: ', dvTableElements.length);

        if (dvTableElements.length > 0) {
            DATA.push({
                iteration: iteration,
                data: dvTableElements
            });
        }
    
        let dvIframeTableElements = await page.evaluate(() => {
            let result = [];
            if (document.getElementById('fm')) {
                let lineElements = document.getElementById('fm').contentWindow.document.body.querySelectorAll('table tr');
                //result = document.getElementById('fm').contentWindow.document.body.querySelectorAll('table tr');
                result = [...lineElements].splice(1).map(el => {
                    return {
                        Account: el.querySelectorAll('td')[0].innerHTML,
                        Transaction: el.querySelectorAll('td')[1].innerHTML,
                        Amount: el.querySelectorAll('td')[2].innerHTML.match(/\d+/g)[0],
                        Currency: el.querySelectorAll('td')[2].innerHTML.match(/\D/g)[0]
                    }
                });
            }
            return result;
        });
    
        console.log('dvIframeTableElements: ', dvIframeTableElements.length);

        if (dvIframeTableElements.length > 0) {
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

        console.log(DATA.length);        

        console.log(`Scraping done in ${Math.floor((finalTime - startTime))} mseconds`); // /1000 seconds

        browserPromise.close();
    }

    processPages(ITERATOR);
}

run();