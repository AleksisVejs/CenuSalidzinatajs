const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class EuronicsScraper extends BaseScraper {
    constructor() {
        super('Euronics', 'https://www.euronics.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/en/search/${encodeURIComponent(keyword)}`;
    }

    async waitForProducts(page) {
        await waitForSelectorWithEarlySuccess(page, '.product-card.vertical', 15000);
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('article.product-card.vertical').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            document.querySelectorAll('article.product-card.vertical').forEach(productCard => {
                try {
                    // Get title from the product card title
                    const titleElement = productCard.querySelector('.product-card__title');
                    const title = titleElement ? titleElement.textContent.trim() : null;

                    // Get price from the data attribute
                    const priceAttribute = productCard.getAttribute('data-product-price');
                    let price = null;
                    if (priceAttribute) {
                        const numPrice = Number(priceAttribute);
                        price = numPrice.toFixed(2).replace('.', ',') + ' €';
                    }

                    // Get URL from the product image link
                    const linkElement = productCard.querySelector('.product-card__image-div a');
                    const url = linkElement ? linkElement.getAttribute('href') : null;
                    // Make sure URL is absolute
                    const fullUrl = url ? (url.startsWith('http') ? url : `https://www.euronics.lv${url}`) : null;

                    // Get image URL
                    const imageElement = productCard.querySelector('.product-card__image.responsive-image');
                    let image = imageElement ? imageElement.getAttribute('src') : null;
                    if (image && !image.startsWith('http')) {
                        image = `https://www.euronics.lv${image}`;
                    }

                    // Get availability
                    const availabilityElement = productCard.querySelector('.badge.badge--success');
                    const availability = availabilityElement ? availabilityElement.textContent.trim() : null;

                    if (title && price && fullUrl) {
                        items.push({
                            title,
                            price,
                            url: fullUrl,
                            image,
                            availability
                        });
                    }
                } catch (error) {
                    console.error('Error processing Euronics product:', error);
                }
            });
            return items;
        });
    }
}

module.exports = EuronicsScraper; 