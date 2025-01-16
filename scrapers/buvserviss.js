const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class BuvservissScraper extends BaseScraper {
    constructor() {
        super('Buvserviss', 'https://www.buvserviss.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/site/search?search=${encodeURIComponent(keyword)}`;
    }

    async waitForProducts(page) {
        try {
            await Promise.race([
                waitForSelectorWithEarlySuccess(page, '.products-list', 15000),
                waitForSelectorWithEarlySuccess(page, '.empty-state', 15000)
            ]);
        } catch (timeoutError) {
            console.log('Buvserviss: Timeout waiting for results');
            return false;
        }
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('.product-card').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.product-card').forEach(element => {
                try {
                    // Get title
                    const titleElement = element.querySelector('.name a');
                    const title = titleElement ? titleElement.textContent.trim() : null;

                    // Get price
                    const priceElement = element.querySelector('.pcs-price .price');
                    let price = null;
                    if (priceElement) {
                        // Format price: remove all suffixes after slash, remove € from start, and add it at the end
                        price = priceElement.textContent.trim()
                            .replace(/^€\s*/, '')   // Remove euro sign from start
                            .replace(/\/.*$/g, '')  // Remove everything after slash including the slash
                            .replace('.', ',')      // Replace dot with comma
                            .replace(/\s*€\s*/, '') // Remove any remaining euro signs
                            .trim() + ' €';        // Add euro symbol at the end
                    }

                    // Get URL
                    const url = titleElement ? titleElement.getAttribute('href') : null;
                    // Make URL absolute
                    const fullUrl = url ? (url.startsWith('http') ? url : `https://www.buvserviss.lv${url}`) : null;

                    // Get image URL
                    const imageElement = element.querySelector('.image img');
                    let image = imageElement ? imageElement.getAttribute('src') : null;
                    if (image && !image.startsWith('http')) {
                        image = `https://www.buvserviss.lv${image}`;
                    }

                    // Get availability
                    const availabilityElement = element.querySelector('.status');
                    const availability = availabilityElement ? availabilityElement.textContent.trim() : null;

                    // Get old price if exists (for discounts)
                    const oldPriceElement = element.querySelector('.old-price');
                    const oldPrice = oldPriceElement ? oldPriceElement.textContent.trim()
                        .replace(/^€\s*/, '')   // Remove euro sign from start
                        .replace(/\/.*$/g, '')  // Remove everything after slash including the slash
                        .replace('.', ',')      // Replace dot with comma
                        .replace(/\s*€\s*/, '') // Remove any remaining euro signs
                        .trim() + ' €' : null;  // Add euro symbol at the end

                    if (title && price && fullUrl) {
                        items.push({
                            title,
                            price,
                            url: fullUrl,
                            image,
                            availability,
                            oldPrice
                        });
                    }
                } catch (error) {
                    console.error('Error processing Buvserviss product:', error);
                }
            });
            return items;
        });
    }
}

module.exports = BuvservissScraper; 