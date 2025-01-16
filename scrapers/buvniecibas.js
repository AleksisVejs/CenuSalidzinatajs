const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class BuvniecibasScraper extends BaseScraper {
    constructor() {
        super('Buvniecibas ABC', 'https://buvniecibas-abc.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/lv/meklesana?query=${encodeURIComponent(keyword)}&search=`;
    }

    async waitForProducts(page) {
        await waitForSelectorWithEarlySuccess(page, '.products.grid-view', 15000);
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('.products.grid-view .item .product').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.products.grid-view .item .product').forEach(element => {
                try {
                    // Get title
                    const titleElement = element.querySelector('.title a');
                    const title = titleElement ? titleElement.textContent.trim() : null;

                    // Get price
                    const priceElement = element.querySelector('.price');
                    let price = null;
                    if (priceElement) {
                        const rawPriceText = priceElement.textContent.trim();
                        const hasBackslash = rawPriceText.includes('/');
                        const priceText = rawPriceText
                            .replace(/[^\d,.]*/g, '')  // Remove everything except digits, comma and dot
                            .replace('.', hasBackslash ? '.' : ',')  // Replace dot with comma only if no backslash
                            .trim() + ' €';           // Add euro symbol at the end
                        price = priceText;
                    }

                    // Get URL
                    const url = titleElement ? titleElement.getAttribute('href') : null;

                    // Get image URL
                    const imageElement = element.querySelector('.image img');
                    let image = imageElement ? imageElement.getAttribute('data-src') || imageElement.getAttribute('src') : null;

                    // Get article number
                    const articleElement = element.querySelector('.article');
                    const article = articleElement ? articleElement.textContent.trim() : null;

                    if (title && price && url) {
                        items.push({
                            title,
                            price,
                            url,
                            image,
                            article
                        });
                    }
                } catch (error) {
                    console.error('Error processing Buvniecibas ABC product:', error);
                }
            });
            return items;
        });
    }
}

module.exports = BuvniecibasScraper; 