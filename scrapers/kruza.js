const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class KruzaScraper extends BaseScraper {
    constructor() {
        super('Kruza', 'https://www.kruza.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/site/search?query=${encodeURIComponent(keyword)}`;
    }

    async waitForProducts(page) {
        await waitForSelectorWithEarlySuccess(page, '.product-list', 15000);
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('.product-list .item.product-order').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.product-list .item.product-order').forEach(element => {
                try {
                    // Get title
                    const titleElement = element.querySelector('.text .tit');
                    const title = titleElement ? titleElement.textContent.trim() : null;

                    // Get price - format to only use commas, no dots
                    const priceElement = element.querySelector('.bottom .price');
                    let price = null;
                    if (priceElement) {
                        const rawPrice = priceElement.textContent.trim();
                        // Remove € symbol, replace dots with commas, remove anything after backslash
                        price = rawPrice
                            .replace(/[^\d,.]*/g, '')  // Remove everything except digits, comma and dot
                            .replace('.', ',')         // Replace dot with comma
                            .replace(/\/.*$/, '')      // Remove anything after backslash
                            .trim() + ' €';           // Add euro symbol at the end
                    }

                    // Get URL
                    const url = titleElement ? 'https://www.kruza.lv' + titleElement.getAttribute('href') : null;

                    // Get image URL
                    const imageElement = element.querySelector('.image img');
                    let image = imageElement ? imageElement.getAttribute('src') : null;
                    if (image && !image.startsWith('http')) {
                        image = `https://www.kruza.lv${image}`;
                    }

                    // Check if item is on sale (has discount label)
                    const hasDiscount = element.querySelector('.label') !== null;

                    if (title && price && url) {
                        items.push({
                            title,
                            price,
                            url,
                            image,
                            hasDiscount
                        });
                    }
                } catch (error) {
                    console.error('Error processing Kruza product:', error);
                }
            });
            return items;
        });
    }
}

module.exports = KruzaScraper; 