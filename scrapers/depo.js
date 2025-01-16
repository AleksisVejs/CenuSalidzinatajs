const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class DepoScraper extends BaseScraper {
    constructor() {
        super('DEPO', 'https://online.depo.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/search/${encodeURIComponent(keyword)}`;
    }

    async waitForProducts(page) {
        try {
            await Promise.race([
                waitForSelectorWithEarlySuccess(page, '.grid-cols-5', 15000),
                waitForSelectorWithEarlySuccess(page, '.empty-state', 15000)
            ]);
        } catch (timeoutError) {
            console.log('DEPO: Timeout waiting for results');
            return false;
        }
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('.flex.h-full.min-h-\\[340px\\]').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            const productElements = document.querySelectorAll('.flex.h-full.min-h-\\[340px\\]');
            
            productElements.forEach(element => {
                try {
                    // Get product title and URL
                    const titleElement = element.querySelector('a.clickable.font-sans.text-xs.font-bold');
                    if (!titleElement) return;
                    
                    const title = titleElement.getAttribute('title')?.trim();
                    const url = 'https://online.depo.lv' + titleElement.getAttribute('href');
                    
                    // Get price information
                    const priceElement = element.querySelector('.whitespace-nowrap.font-extrabold');
                    if (!priceElement) return;
                    
                    const priceText = priceElement.textContent.trim();
                    const price = priceText.replace(/[^\d,.]*/g, '').trim();
                    
                    // Format price with comma
                    const numPrice = Number(price);
                    const formattedPrice = numPrice.toFixed(2).replace('.', ',') + ' €';
                    
                    // Get image URL
                    const imageElement = element.querySelector('.ms-Image img');
                    let image = imageElement ? imageElement.getAttribute('data-src') || imageElement.getAttribute('src') : null;
                    if (image && !image.startsWith('http')) {
                        image = `https://online.depo.lv${image}`;
                    }
                    
                    if (title && url && formattedPrice) {
                        items.push({
                            title,
                            price: formattedPrice,
                            url,
                            image
                        });
                    }
                } catch (error) {
                    console.error('Error processing DEPO product:', error);
                }
            });
            
            return items;
        });
    }
}

module.exports = DepoScraper; 