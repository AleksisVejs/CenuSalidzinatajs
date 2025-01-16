const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class BuvdarbiemScraper extends BaseScraper {
    constructor() {
        super('Buvdarbiem.lv', 'https://www.buvdarbiem.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/precu-meklesana?search=${encodeURIComponent(keyword)}`;
    }

    async waitForProducts(page) {
        await waitForSelectorWithEarlySuccess(page, '.product-grid-list', 15000);
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('.product-layout.product-grid').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.product-layout.product-grid').forEach(element => {
                try {
                    // Get title
                    const titleElement = element.querySelector('.caption h4 a');
                    const title = titleElement ? titleElement.textContent.trim() : null;

                    // Get price - format to match other stores (X,XX €)
                    const priceElement = element.querySelector('.price');
                    let price = null;
                    if (priceElement) {
                        const rawPrice = priceElement.textContent.trim();
                        // Convert price format from X.XX€ to X,XX €
                        price = rawPrice
                            .replace(/[^\d.,]/g, '') // Remove everything except digits, dots and commas
                            .replace('.', ',')      // Replace dot with comma
                            .trim() + ' €';        // Add euro symbol with space
                    }

                    // Get URL
                    const url = titleElement ? titleElement.getAttribute('href') : null;

                    // Get image URL
                    const imageElement = element.querySelector('.image img');
                    let image = imageElement ? imageElement.getAttribute('src') : null;

                    // Get description
                    const descElement = element.querySelector('.desc');
                    const description = descElement ? descElement.textContent.trim() : null;

                    if (title && price && url) {
                        items.push({
                            title,
                            price,
                            url,
                            image,
                            description
                        });
                    }
                } catch (error) {
                    console.error('Error processing Buvdarbiem.lv product:', error);
                }
            });
            return items;
        });
    }
}

module.exports = BuvdarbiemScraper; 