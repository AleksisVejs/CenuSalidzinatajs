const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class RdveikalsScraper extends BaseScraper {
    constructor() {
        super('RD Veikals', 'https://www.rdveikals.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/search/lv/word/${encodeURIComponent(keyword)}/page/1/`;
    }

    async waitForProducts(page) {
        await waitForSelectorWithEarlySuccess(page, '.product-list', 15000);
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('li.col.col--xs-4.product.js-product').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const products = Array.from(document.querySelectorAll('li.col.col--xs-4.product.js-product'));
            return products.map(element => {
                const titleElement = element.querySelector('.product__title a');
                const priceElement = element.querySelector('.price b');
                const imageElement = element.querySelector('figure img');
                const linkElement = element.querySelector('a.overlay');

                if (!titleElement || !priceElement) return null;

                const title = titleElement.textContent.trim();
                const priceText = priceElement.textContent.trim();
                const price = priceText.replace(/[^\d,.]*/g, '').replace('.', ',') + ' €';
                const url = linkElement ? 
                    'https://www.rdveikals.lv/' + linkElement.getAttribute('href').replace(/^\/+/, '') : null;
                let image = imageElement ? imageElement.getAttribute('src') : null;
                if (image && !image.startsWith('http')) {
                    image = `https://www.rdveikals.lv/${image.replace(/^\/+/, '')}`;
                }

                return {
                    title,
                    price,
                    url,
                    image
                };
            }).filter(Boolean);
        });
    }
}

module.exports = RdveikalsScraper; 