const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class Bau24Scraper extends BaseScraper {
    constructor() {
        super('Bau24', 'https://bau24.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/?subcats=Y&status=A&pshort=Y&pfull=Y&pname=Y&pkeywords=Y&search_performed=Y&q=${encodeURIComponent(keyword)}`;
    }

    async waitForProducts(page) {
        try {
            await Promise.race([
                waitForSelectorWithEarlySuccess(page, '.mainbox-body', 15000),
                waitForSelectorWithEarlySuccess(page, 'form[name^="product_form_"]', 15000),
                waitForSelectorWithEarlySuccess(page, '.product-title', 15000)
            ]);
            // Add a small delay to ensure dynamic content is loaded
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (timeoutError) {
            console.log('Bau24: Timeout waiting for results');
            return false;
        }
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('form[name^="product_form_"]').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            document.querySelectorAll('form[name^="product_form_"]').forEach(element => {
                try {
                    // Get title - using the correct class from the HTML
                    const titleElement = element.querySelector('a.product-title');
                    const title = titleElement ? titleElement.getAttribute('title') || titleElement.textContent.trim() : null;

                    // Get price - format to use commas instead of dots
                    const priceSpan = element.querySelector('span[id^="discounted_price_"]');
                    let price = null;
                    if (priceSpan) {
                        const rawPrice = priceSpan.textContent.trim();
                        price = rawPrice.replace('.', ',') + ' €';
                    }

                    // Get URL
                    const url = titleElement ? titleElement.href : null;

                    // Get image URL
                    let image = null;
                    const imageElement = element.querySelector('img.pict');
                    if (imageElement) {
                        image = imageElement.getAttribute('src');
                        // Ensure the image URL is absolute
                        if (image && !image.startsWith('http')) {
                            image = new URL(image, 'https://bau24.lv').href;
                        }
                    }

                    // Check if item has discount
                    const hasDiscount = element.querySelector('.thumb-discount-label') !== null;

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
                    console.error('Error processing Bau24 product:', error);
                }
            });
            return items;
        });
    }
}

module.exports = Bau24Scraper; 