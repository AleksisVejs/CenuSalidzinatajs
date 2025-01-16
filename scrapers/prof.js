const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class ProfScraper extends BaseScraper {
    constructor() {
        super('Prof.lv', 'https://prof.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/catalogsearch/result/?q=${encodeURIComponent(keyword)}`;
    }

    async waitForProducts(page) {
        try {
            await Promise.race([
                waitForSelectorWithEarlySuccess(page, '.products.list.items.product-items.row', 15000),
                waitForSelectorWithEarlySuccess(page, '.empty-search-results', 15000)
            ]);
        } catch (timeoutError) {
            console.log('Prof.lv: Timeout waiting for results');
            return false;
        }
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('.item.product.product-item.col-xl-3.col-lg-4.col-md-4.col-sm-6.col-6').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.item.product.product-item.col-xl-3.col-lg-4.col-md-4.col-sm-6.col-6').forEach(element => {
                try {
                    // Get title
                    const titleElement = element.querySelector('.product-item-link');
                    const title = titleElement ? titleElement.textContent.trim() : null;

                    // Get price - check for special price first, then regular price
                    let price = null;
                    const specialPriceElement = element.querySelector('[data-price-type="finalPrice"] .price');
                    const regularPriceElement = element.querySelector('[data-price-type="oldPrice"] .price');
                    
                    if (specialPriceElement) {
                        price = specialPriceElement.textContent.trim()
                            .replace(/^€\s*/, '')   // Remove euro sign from start
                            .replace(/\s*€\s*/, '') // Remove any remaining euro signs
                            .trim() + ' €';        // Add euro symbol at the end
                    } else if (regularPriceElement) {
                        price = regularPriceElement.textContent.trim()
                            .replace(/^€\s*/, '')   // Remove euro sign from start
                            .replace(/\s*€\s*/, '') // Remove any remaining euro signs
                            .trim() + ' €';        // Add euro symbol at the end
                    }

                    // Get URL
                    const linkElement = element.querySelector('.product-item-link');
                    const url = linkElement ? linkElement.getAttribute('href') : null;

                    // Get image URL
                    const imageElement = element.querySelector('.product-image-photo-og');
                    let image = null;
                    if (imageElement) {
                        // Try to get the largest image from srcset if available
                        const srcset = imageElement.getAttribute('srcset');
                        if (srcset) {
                            const srcsetParts = srcset.split(',').map(part => part.trim());
                            const lastSrc = srcsetParts[srcsetParts.length - 1];
                            image = lastSrc.split(' ')[0]; // Get the URL part
                        } else {
                            image = imageElement.getAttribute('src');
                        }
                    }
                    
                    if (title && price && url) {
                        items.push({
                            title,
                            price,
                            url,
                            image
                        });
                    }
                } catch (error) {
                    console.error('Error processing Prof.lv product:', error);
                }
            });
            return items;
        });
    }
}

module.exports = ProfScraper; 