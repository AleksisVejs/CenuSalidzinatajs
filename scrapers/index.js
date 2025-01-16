const { initBrowser, closeBrowser, ensureBrowser } = require('./base');
const OnealvScraper = require('./onealv');
const KsenukaiScraper = require('./ksenukai');
const DateksScraper = require('./dateks');
const RdveikalsScraper = require('./rdveikals');
const EuronicsScraper = require('./euronics');
const DepoScraper = require('./depo');
const ProfScraper = require('./prof');
const BuvservissScraper = require('./buvserviss');
const BuvniecibasScraper = require('./buvniecibas');
const KruzaScraper = require('./kruza');
const Bau24Scraper = require('./bau24');
const BuvdarbiemScraper = require('./buvdarbiem');

// Initialize all scrapers
const scrapers = {
    '1a.lv': new OnealvScraper(),
    'Ksenukai': new KsenukaiScraper(),
    'Dateks': new DateksScraper(),
    'RD Veikals': new RdveikalsScraper(),
    'Euronics': new EuronicsScraper(),
    'DEPO': new DepoScraper(),
    'Prof.lv': new ProfScraper(),
    'Buvserviss': new BuvservissScraper(),
    'Buvniecibas ABC': new BuvniecibasScraper(),
    'Kruza': new KruzaScraper(),
    'Bau24': new Bau24Scraper(),
    'Buvdarbiem.lv': new BuvdarbiemScraper()
};

class ScrapingManager {
    constructor() {
        this.minProductsNeeded = 3;
        this.maxRetries = 2;
        this.storeTimeout = 45000;
        this.delayBetweenStores = 2000;
    }

    async initialize() {
        await initBrowser();
    }

    async cleanup() {
        await closeBrowser();
    }

    async scrapeStore(store, keyword) {
        let retryCount = 0;
        while (retryCount < this.maxRetries) {
            try {
                // Ensure browser is ready before each attempt
                await ensureBrowser();
                
                const scraper = scrapers[store];
                const results = await Promise.race([
                    scraper.scrape(keyword),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout for ${store}`)), this.storeTimeout)
                    )
                ]);
                
                return results || [];
            } catch (error) {
                console.error(`Error scraping ${store} (attempt ${retryCount + 1}/${this.maxRetries}):`, error.message);
                retryCount++;
                
                // Cleanup and reinitialize on failure
                await this.cleanup();
                await this.initialize();
                
                // Add delay before retry
                await new Promise(resolve => setTimeout(resolve, this.delayBetweenStores));
            }
        }
        return []; // Return empty array if all retries failed
    }

    async scrapeProducts(keyword, selectedStores = Object.keys(scrapers)) {
        try {
            const storeResults = {};
            let totalProducts = 0;
            
            // Filter only available scrapers
            const availableStores = selectedStores.filter(store => store in scrapers);
            
            // Process stores sequentially
            for (const store of availableStores) {
                try {
                    // Ensure browser is ready before each store
                    await ensureBrowser();
                    
                    const results = await this.scrapeStore(store, keyword);
                    storeResults[store] = results;
                    totalProducts += results.length;
                    console.log(`${store}: Found ${results.length} results. Total so far: ${totalProducts}`);
                    
                    // Small delay between stores
                    if (store !== availableStores[availableStores.length - 1]) {
                        await new Promise(resolve => setTimeout(resolve, this.delayBetweenStores));
                    }
                } catch (error) {
                    console.error(`Failed to scrape ${store}:`, error.message);
                    storeResults[store] = [];
                    
                    // Ensure browser is reinitialized after error
                    await this.cleanup();
                    await this.initialize();
                }
            }
            
            const allResults = Object.entries(storeResults)
                .filter(([_, results]) => Array.isArray(results))
                .flatMap(([store, results]) => 
                    results.map(result => ({
                        ...result,
                        store
                    }))
                );

            console.log('Total results found:', allResults.length);
            return allResults;

        } catch (error) {
            console.error('Scraping error:', error);
            return [];
        } finally {
            // Ensure browser is cleaned up
            await this.cleanup();
        }
    }

    getAvailableStores() {
        return Object.keys(scrapers);
    }

    addScraper(name, scraper) {
        scrapers[name] = scraper;
    }
}

module.exports = new ScrapingManager(); 