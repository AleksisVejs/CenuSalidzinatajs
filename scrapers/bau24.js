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
            console.log('Waiting for product elements...');
            await Promise.race([
                waitForSelectorWithEarlySuccess(page, '.mainbox-body', 15000),
                waitForSelectorWithEarlySuccess(page, 'form[name^="product_form_"]', 15000),
                waitForSelectorWithEarlySuccess(page, '.product-title', 15000)
            ]);
            
            // Add a longer delay to ensure dynamic content is loaded
            console.log('Initial elements found, waiting for dynamic content...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Wait for network to be idle
            await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {
                console.log('Network idle timeout, continuing anyway');
            });
            
            console.log('Wait complete');
            return true;
        } catch (timeoutError) {
            console.log('Bau24: Timeout waiting for results');
            return false;
        }
    }

    async checkForResults(page) {
        console.log('Checking for results...');
        const hasResults = await Promise.race([
            page.evaluate(() => {
                const products = document.querySelectorAll('form[name^="product_form_"]');
                console.log(`Found ${products.length} products`);
                return products.length > 0;
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
        ]);

        console.log(`Results found: ${hasResults}`);
        return hasResults;
    }

    async extractProducts(page) {
        console.log('Extracting products...');
        
        // First collect all image URLs from the page
        const imageUrls = await page.evaluate(() => {
            const urls = new Set();
            document.querySelectorAll('img').forEach(img => {
                const src = img.getAttribute('src');
                if (src && (src.includes('/detailed/') || src.includes('/thumbnails/'))) {
                    urls.add(src);
                }
            });
            return Array.from(urls);
        });
        console.log(`Found ${imageUrls.length} product images on page`);
        
        return page.evaluate((knownImageUrls) => {
            // Helper function to clean text for matching
            function cleanText(text) {
                return text.toLowerCase()
                    .replace(/[āáǎàä]/g, 'a')
                    .replace(/[ēéěèë]/g, 'e')
                    .replace(/[īíǐìï]/g, 'i')
                    .replace(/[ōóǒòö]/g, 'o')
                    .replace(/[ūúǔùü]/g, 'u')
                    .replace(/[ļĺľ]/g, 'l')
                    .replace(/[ņńň]/g, 'n')
                    .replace(/[ķḱ]/g, 'k')
                    .replace(/[š]/g, 's')
                    .replace(/[^a-z0-9]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '');
            }
            
            // Helper function to extract key terms from text
            function getKeyTerms(text) {
                return cleanText(text)
                    .split('_')
                    .filter(term => term.length > 2) // Only terms longer than 2 chars
                    .sort((a, b) => b.length - a.length); // Longest terms first
            }
            
            // Helper function to find best matching image URL
            function findBestMatchingImage(title, url) {
                if (!title && !url) return null;
                
                // Get key terms from title and URL
                const titleTerms = title ? getKeyTerms(title) : [];
                const urlTerms = url ? getKeyTerms(url.split('/').pop()) : [];
                const allTerms = [...new Set([...titleTerms, ...urlTerms])];
                
                let bestMatch = null;
                let bestMatchScore = 0;
                
                for (const imgUrl of knownImageUrls) {
                    const imgTerms = getKeyTerms(imgUrl.split('/').pop());
                    
                    // Calculate match score
                    let score = 0;
                    for (const term of allTerms) {
                        if (imgTerms.some(imgTerm => 
                            imgTerm.includes(term) || term.includes(imgTerm))) {
                            score += term.length; // Longer matching terms get higher scores
                        }
                    }
                    
                    if (score > bestMatchScore) {
                        bestMatchScore = score;
                        bestMatch = imgUrl;
                    }
                }
                
                return bestMatchScore > 3 ? bestMatch : null; // Require minimum match quality
            }

            const items = [];
            const products = document.querySelectorAll('form[name^="product_form_"]');
            console.log(`Processing ${products.length} products`);

            products.forEach((element, index) => {
                try {
                    console.log(`Processing product ${index + 1}`);
                    
                    // Get title
                    const titleElement = element.querySelector('a.product-title');
                    const title = titleElement ? titleElement.getAttribute('title') || titleElement.textContent.trim() : null;
                    console.log(`Title found: ${title ? 'Yes' : 'No'}`);

                    // Get price
                    const priceSpan = element.querySelector('span[id^="discounted_price_"]');
                    let price = null;
                    if (priceSpan) {
                        const rawPrice = priceSpan.textContent.trim();
                        price = rawPrice.replace('.', ',') + ' €';
                    }
                    console.log(`Price found: ${price ? 'Yes' : 'No'}`);

                    // Get URL
                    const url = titleElement ? titleElement.href : null;
                    console.log(`URL found: ${url ? 'Yes' : 'No'}`);

                    // Find matching image URL
                    const image = findBestMatchingImage(title, url);
                    console.log(`Image found: ${image ? 'Yes' : 'No'}`);

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
                        console.log('Product added to results');
                    } else {
                        console.log('Skipping product due to missing required fields');
                    }
                } catch (error) {
                    console.error(`Error processing Bau24 product ${index + 1}:`, error.message);
                }
            });
            
            console.log(`Extracted ${items.length} products`);
            return items;
        }, imageUrls);
    }
}

module.exports = Bau24Scraper; 