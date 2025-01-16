const { BaseScraper, waitForSelectorWithEarlySuccess } = require('./base');

class DateksScraper extends BaseScraper {
    constructor() {
        super('Dateks', 'https://www.dateks.lv');
    }

    getSearchUrl(keyword) {
        return `${this.baseUrl}/meklet?q=${encodeURIComponent(keyword)}`;
    }

    async waitForProducts(page) {
        await waitForSelectorWithEarlySuccess(page, '.list', 15000);
    }

    async checkForResults(page) {
        const hasResults = await Promise.race([
            page.evaluate(() => {
                return document.querySelectorAll('.list .prod').length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        return hasResults;
    }

    async extractProducts(page) {
        return page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.list .prod').forEach(element => {
                try {
                    // Get title
                    const titleElement = element.querySelector('.name span');
                    const title = titleElement ? titleElement.textContent.trim() : null;

                    // Get price
                    const priceElement = element.querySelector('.price');
                    let price = null;
                    if (priceElement) {
                        const rawPriceText = priceElement.textContent.trim();
                        const hasBackslash = rawPriceText.includes('/');
                        const priceText = rawPriceText
                            .replace(/[^\d,.]*/g, '')  // Remove everything except digits, comma and dot
                            .replace('.', hasBackslash ? '' : ',')  // Remove dot if backslash, otherwise replace with comma
                            .replace(/\./g, '')        // Remove ALL dots
                            .trim() + ' €';           // Add euro symbol at the end
                        price = priceText;
                    }

                    // Get URL
                    const linkElement = element.querySelector('a.imp');
                    const url = linkElement ? 'https://www.dateks.lv' + linkElement.getAttribute('href') : null;

                    // Get image URL
                    let image = null;
                    const galleryElement = element.querySelector('.gal.thumb');
                    if (galleryElement) {
                        const dataPics = galleryElement.getAttribute('data-pics');
                        if (dataPics) {
                            try {
                                const imageIds = JSON.parse(dataPics);
                                if (imageIds && imageIds.length > 0) {
                                    const firstImageId = imageIds[0];
                                    // Construct URL using first image ID
                                    image = `https://www.dateks.lv/images/pic/1200/1200/${firstImageId % 1000}/${Math.floor(firstImageId / 1000)}.jpg`;
                                }
                            } catch (e) {
                                console.error('Error parsing image data:', e);
                            }
                        }
                    }

                    // Get availability
                    const availElement = element.querySelector('.avail');
                    const availability = availElement ? availElement.textContent.trim() : null;

                    if (title && price && url) {
                        items.push({
                            title,
                            price,
                            url,
                            image,
                            availability
                        });
                    }
                } catch (error) {
                    console.error('Error processing Dateks product:', error);
                }
            });
            return items;
        });
    }
}

module.exports = DateksScraper; 