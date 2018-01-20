/**
 * (c) 2018 Vincent Ogloblinsky / MIT Licence
 * 
 * Scraping des données en ouvrant en // des onglets dans Chrome Headless.
 * Le premier onglet récupérant aucune donnée arrête la boucle de recherche.
 */

/**
 * Utilisation de puppeteer pour le pilotage de chrome headless
 */
const puppeteer = require('puppeteer'),
      /**
       * Librairie pour la création fu fichier JSON final
       */
      fs = require('fs-extra'),
      /**
       * Librairie pour le traitement des données brutes
       */
      _ = require('lodash'),
      /**
       * URL finale de scraping
       */
      URL = 'https://web.bankin.com/challenge/index.html', // 'https://web.bankin.com/challenge/index.html' // http://localhost/TMP/bankin-web-scraping-challenge/original-src/
      /**
       * Increment de scraping par page
       */
      SEARCH_PAGINATION_INCREMENT = 50,
      /**
       * Nombre de requêtes // de recherche
       */
      SEARCH_PAGINATION_TABS = 101;

/**
 * Tableau des paginateurs de recherches
 */
let ITERATOR_PAGINATION = [];

/**
 * Données brutes
 */
let DATA = [],
    /**
     * Tableau des itérations pour laquelle la page est vide
     */
    ERROR_DATA = [];

/**
 * Fonction de démarrage du scraping
 */
async function start() {

    /**
     * Sauvegarde du timestamp de démarrage du script
     */
    let startTime = (new Date()).getTime();

    /**
     * Création d'une instance puppeteer en mode headless
     */
    const browserPromise = await puppeteer.launch({
        headless: true
    });

    /**
     * Catch des erreurs puppeteer sur le dismiss de dialog dans des onglets multiples, bug puppeteer ?
     */
    process.on("unhandledRejection", (reason, p) => {
        //console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
    });

    /**
     * Lancement du scraping avec les itérations
     */
    processPages();

    /**
     * Fonction de création des appels en // sur l'url à scraper
     */
    async function processPages() {

        // Incrément de la boucle de remplissage des paginateurs
        let i,
            // Max de requête en // pour le remplissage des paginateurs
            len,
            // Incrément du do
            incDo = 1;

        /**
         * Recherche de la fin de pagination
         * Tant que le tableau ERROR_DATA n'est pas vide, nous allons scraper par paquets de plusieurs requêtes
         */
        do {
            // Vidage du tableau de paginateurs
            ITERATOR_PAGINATION = [];

            i = ((incDo - 1) * SEARCH_PAGINATION_TABS) + 1;
            if ((incDo - 1) === 0) { i = 0;}
            len = SEARCH_PAGINATION_TABS * incDo;

            // Remplissage des paginateurs
            for (i; i <= len; i++) {
                ITERATOR_PAGINATION.push( i * SEARCH_PAGINATION_INCREMENT);
            }

            /**
             * Création des promesses en utilisant la fonction scrapPage
             */
            let promises = ITERATOR_PAGINATION.map(scrapPage);

            /**
             * Attente de la fin d'appel de toutes les urls scrapées en //
             */
            await Promise.all(promises);

            // On crée un nouveau paquet
            incDo += 1;

        } while (ERROR_DATA.length === 0)

        /**
         * Trie des données brutes par itération, celles-ci étant résolues aléatoirement en //
         */
        DATA = _.sortBy(DATA, ['iteration']);

        /**
         * Données finales
         */
        let FINAL_DATA = [];

        /**
         * Remplissage des données finales à partir des données brutes
         */
        DATA.forEach((it) => {
            FINAL_DATA = [...FINAL_DATA, ...it.data];  
        });

        console.log(`Nombre de données récupérées: ${FINAL_DATA.length}`);

        /**
         * Création d'un fichier JSON
         */
        fs.outputJson('./DATA.json', FINAL_DATA)
            .then(() => {
                /**
                 * Sauvegarde du timestamp final du script
                 */
                let finalTime = (new Date()).getTime();
                console.log(`Scraping done in ${Math.floor((finalTime - startTime) / 1000)} seconds`);
            })
            .catch(err => {
                console.error(err)
            });

        /**
         * Fermeture de l'instance puppeteer
         */
        browserPromise.close();
    }

    /**
     * Fonction principale de scraping
     * @param {number} iteration 
     */
    async function scrapPage(iteration) {
        try {
            console.log(`Scraping ${URL}?start=${iteration}`);        

            /**
             * Récupération de l'instance du browser
             */
            const browser = await browserPromise;

            /**
             * Création d'une page
             */
            const page = await browser.newPage();

            /**
             * Interception des alerts
             */
            page.on('dialog', dialog => {
                dialog.dismiss();
                /**
                 * Clic sur le bouton dédié de génération manuelle
                 */
                page.click('#btnGenerate');
            });

            /**
             * Ouverture d'un onglet
             */
            await page.goto(`${URL}?start=${iteration}`, {
                waitUntil : 'domcontentloaded'
            });
        
            /**
             * Polling d'attente (10ms) de la présence dans le DOM du tableau en direct, ou dans une iframe
             */
            const watchDog = page.waitForFunction(`(Object.keys(document.querySelectorAll('#dvTable tr')).length > 0) || (document.getElementById('fm') !== null && Object.keys(document.getElementById('fm').contentWindow.document.body.querySelectorAll('table tr')).length > 0)`, {
                polling: 10
            });
        
            await watchDog;

            /**
             * Récupération des informations dans le tableau en direct
             */    
            let dvTableElements = await page.evaluate((sel) => {
                /**
                 * On supprime la première ligne d'entête du tableau, et ensuite on récupère les données
                 */
                return [...document.querySelectorAll(sel)].splice(1).map(el => {
                    return {
                        Account: el.querySelectorAll('td')[0].innerHTML,
                        Transaction: el.querySelectorAll('td')[1].innerHTML,
                        Amount: el.querySelectorAll('td')[2].innerHTML.match(/\d+/g)[0],
                        Currency: el.querySelectorAll('td')[2].innerHTML.match(/\D/g)[0]
                    }
                });
            }, '#dvTable tr');
        
            /**
             * Si nous avons des données, sauvegardons les dans le tableau temporaire
             */
            if (dvTableElements.length > 0) {
                DATA.push({
                    iteration: iteration,
                    data: dvTableElements
                });
            }

            /**
             * Récupération des informations dans le tableau dans l'iframe
             */    
            let dvIframeTableElements = await page.evaluate(() => {
                let result = [];
                if (document.getElementById('fm')) {
                    let lineElements = document.getElementById('fm').contentWindow.document.body.querySelectorAll('table tr');
                    /**
                     * On supprime la première ligne d'entête du tableau, et ensuite on récupère les données
                     */
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
        
            /**
             * Si nous avons des données, sauvegardons les dans le tableau temporaire
             */
            if (dvIframeTableElements.length > 0) {
                DATA.push({
                    iteration: iteration,
                    data: dvIframeTableElements
                });
            }

            /**
             * Si on ne trouve rien, annulation de la promesse du await
             */
            if (dvIframeTableElements.length === 0 && dvTableElements.length === 0) {
                ERROR_DATA.push(iteration);
                throw Error('no data');
            }
        } catch (err) {
            // Interception de l'annulation de la promesse
        }
    }    
}

/**
 * Appel de la fonction de démarrage
 */
start();