const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class OnealvScraper extends BaseScraper {
    constructor() {
        super('1a.lv', 'https://www.1a.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/lv/search?q=${encodeURIComponent(keyword)}`;
    }

    async waitForProducts(page) {
        await waitForSelectorWithEarlySuccess(page, '.sn-product.ks-new-product-item', 15000);
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('.sn-product.ks-new-product-item').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        if (!hasResults) {
            const hasEmptyResults = await page.$('.empty-search-results');
            return !hasEmptyResults;
        }
        return true;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.sn-product.ks-new-product-item').forEach(element => {
                const title = element.querySelector('.ks-new-product-name')?.textContent.trim();
                
                // Try loyalty price first, then regular price
                let price = null;
                const loyaltyPriceElement = element.querySelector('.catalog-taxons-product-price__price-number');
                const regularPriceElement = element.querySelector('.ks-item-price span');
                
                if (loyaltyPriceElement) {
                    price = loyaltyPriceElement.textContent.trim();
                } else if (regularPriceElement) {
                    price = regularPriceElement.textContent.trim();
                }
                
                // Clean up price string and add euro sign
                if (price) {
                    price = price.replace(/[\\n\\t]/g, '').replace(/\s+/g, ' ').replace(' €', '').trim() + ' €';
                }

                const anchor = element.querySelector('a.ks-new-product-name');
                const url = anchor ? 'https://www.1a.lv' + anchor.getAttribute('href') : null;

                const imageElement = element.querySelector('.ks-new-product-image img');
                const image = imageElement ? imageElement.getAttribute('src') : null;

                if (title && price && url) {
                    items.push({ title, price, url, image });
                }
            });
            return items;
        });
    }
}

module.exports = OnealvScraper; 