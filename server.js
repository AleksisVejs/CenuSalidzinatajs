const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let browser;

// Initialize browser instance
async function initBrowser() {
    browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });
}

// Function to get a new page with stealth settings
async function getStealthPage() {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set default navigation timeout
    await page.setDefaultNavigationTimeout(30000);
    
    return page;
}

async function scrape1a(keyword) {
    const page = await getStealthPage();
    const results = [];
    
    try {
        await page.goto(`https://www.1a.lv/lv/search?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Accept cookies if present
        try {
            const cookieSelector = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
            await page.waitForSelector(cookieSelector, { timeout: 5000 });
            await page.click(cookieSelector);
        } catch (e) {
            // Cookie banner might not be present, continue
        }

        // Wait for products to load
        await page.waitForSelector('.ks-products-list-full', { timeout: 5000 });
        await page.waitForFunction(() => document.querySelectorAll('.ks-products-list-full .sn-product.ks-new-product-item').length > 0 || document.querySelector('.empty-search-results'), { timeout: 5000 });

        const products = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.ks-products-list-full .sn-product.ks-new-product-item').forEach(element => {
                const title = element.querySelector('.ks-new-product-name')?.textContent.trim();
                const priceElement = element.querySelector('.ks-new-product-price .catalog-taxons-product-price__price-number');
                const price = priceElement ? priceElement.textContent.trim().replace(/[\\n\\t]/g, '').replace(/\s+/g, ' ') : null;
                
                // Get the URL from the product image link
                const anchor = element.querySelector('a.ks-new-product-image');
                const url = anchor ? 'https://www.1a.lv' + anchor.getAttribute('href') : null;

                // Get image URL
                const imageElement = element.querySelector('.ks-new-product-image img');
                const image = imageElement ? imageElement.getAttribute('data-src') || imageElement.getAttribute('src') : null;

                if (title && price && url) {
                    items.push({ 
                        title, 
                        price,
                        url,
                        image
                    });
                }
            });
            return items;
        });

        results.push(...products.map(product => ({
            store: '1a.lv',
            ...product
        })));

    } catch (error) {
        console.error('1a.lv scraping error:', error.message);
    } finally {
        await page.close();
    }
    
    return results;
}

async function scrapeKsenukai(keyword) {
    const page = await getStealthPage();
    const results = [];
    
    try {
        await page.goto(`https://www.ksenukai.lv/meklesana?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Accept cookies if present
        try {
            const cookieSelector = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
            await page.waitForSelector(cookieSelector, { timeout: 5000 });
            await page.click(cookieSelector);
        } catch (e) {
            // Cookie banner might not be present, continue
        }

        // Wait for products to load
        await page.waitForSelector('.ks-products-list-full.f96or0t', { timeout: 5000 });
        await page.waitForFunction(() => document.querySelectorAll('.ks-products-list-full.f96or0t .sn-product.ks-new-product-item').length > 0 || document.querySelector('.empty-search'), { timeout: 5000 });

        const products = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.ks-products-list-full.f96or0t .sn-product.ks-new-product-item').forEach(element => {
                const title = element.querySelector('.ks-new-product-name')?.textContent.trim();
                const priceElement = element.querySelector('.ks-new-product-price .catalog-taxons-product-price__price-number');
                const price = priceElement ? priceElement.textContent.trim().replace(/[\\n\\t]/g, '').replace(/\s+/g, ' ') : null;
                
                // Get the URL from the product image link
                const anchor = element.querySelector('a.ks-new-product-image');
                const url = anchor ? 'https://www.ksenukai.lv' + anchor.getAttribute('href').split('?')[0] : null;

                // Get image URL
                const imageElement = element.querySelector('.ks-new-product-image img');
                const image = imageElement ? imageElement.getAttribute('data-src') || imageElement.getAttribute('src') : null;

                if (title && price && url) {
                    items.push({ 
                        title, 
                        price,
                        url,
                        image
                    });
                }
            });
            return items;
        });

        results.push(...products.map(product => ({
            store: 'Ksenukai',
            ...product
        })));

    } catch (error) {
        console.error('Ksenukai scraping error:', error.message);
    } finally {
        await page.close();
    }
    
    return results;
}

async function scrapeDateks(keyword) {
    const page = await getStealthPage();
    const results = [];
    
    try {
        await page.goto(`https://www.dateks.lv/meklet?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for products to load
        await page.waitForSelector('.list', { timeout: 5000 });

        // Extract products
        const products = await page.evaluate(() => {
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
                    const imageElement = element.querySelector('.img.loaded img');
                    let image = imageElement ? imageElement.getAttribute('src') : null;
                    if (image && !image.startsWith('http')) {
                        image = `https://www.dateks.lv${image}`;
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

        results.push(...products.map(product => ({
            store: 'Dateks',
            ...product
        })));

    } catch (error) {
        console.error('Dateks scraping error:', error.message);
    } finally {
        await page.close();
    }
    
    return results;
}

async function scrapeRdveikals(keyword) {
    const page = await getStealthPage();
    const results = [];
    
    try {
        await page.goto(`https://www.rdveikals.lv/search/lv/word/${encodeURIComponent(keyword)}/page/1/`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for products to load
        await page.waitForSelector('.product-list', { timeout: 5000 });

        // RD Veikals
        const rdveikalsResults = await page.evaluate(() => {
            const products = Array.from(document.querySelectorAll('li.col.col--xs-4.product.js-product'));
            return products.map(element => {
                const titleElement = element.querySelector('.product__title a');
                const priceElement = element.querySelector('.price b');
                const imageElement = element.querySelector('figure img');
                const linkElement = element.querySelector('a.overlay');

                if (!titleElement || !priceElement) return null;

                const title = titleElement.textContent.trim();
                const priceText = priceElement.textContent.trim();
                const price = priceText.replace(/[^\d,.]*/g, '').replace('.', ',') + ' €';
                const url = linkElement ? 
                    'https://www.rdveikals.lv/' + linkElement.getAttribute('href').replace(/^\/+/, '') : null;
                let image = imageElement ? imageElement.getAttribute('src') : null;
                if (image && !image.startsWith('http')) {
                    image = `https://www.rdveikals.lv/${image.replace(/^\/+/, '')}`;
                }

                return {
                    title,
                    price,
                    url,
                    image,
                    store: 'RD Veikals'
                };
            }).filter(Boolean);
        });

        results.push(...rdveikalsResults);

    } catch (error) {
        console.error('RD Veikals scraping error:', error.message);
    } finally {
        await page.close();
    }
    
    return results;
}

async function scrapeEuronics(keyword) {
    const page = await getStealthPage();
    const results = [];
    
    try {
        await page.goto(`https://www.euronics.lv/en/search/${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Accept cookies if present
        try {
            const cookieSelector = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
            await page.waitForSelector(cookieSelector, { timeout: 5000 });
            await page.click(cookieSelector);
        } catch (e) {
            // Cookie banner might not be present, continue
        }

        // Wait for products to load using the product card selector
        await page.waitForSelector('.product-card.vertical', { timeout: 10000 });

        // Extract products
        const products = await page.evaluate(() => {
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

        results.push(...products.map(product => ({
            store: 'Euronics',
            ...product
        })));

    } catch (error) {
        console.error('Euronics scraping error:', error.message);
    } finally {
        await page.close();
    }
    
    return results;
}

// Scraping function for DEPO
async function scrapeDepo(keyword) {
    let page = null;
    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setDefaultNavigationTimeout(15000);
        
        // Encode the keyword for URL
        const encodedKeyword = encodeURIComponent(keyword);
        const url = `https://online.depo.lv/search/${encodedKeyword}`;
        
        // Navigate with shorter timeout
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
        });
        
        // Wait for either products or no results indicator
        try {
            await Promise.race([
                page.waitForSelector('.grid-cols-5', { timeout: 5000 }),
                page.waitForSelector('.empty-state', { timeout: 5000 })
            ]);
        } catch (timeoutError) {
            console.log('DEPO: Timeout waiting for results, assuming no products');
            return [];
        }
        
        // Check if products exist
        const products = await page.evaluate(() => {
            const items = [];
            const productElements = document.querySelectorAll('.flex.h-full.min-h-\\[340px\\]');
            
            productElements.forEach(element => {
                try {
                    // Get product title and URL
                    const titleElement = element.querySelector('a.clickable.font-sans.text-xs.font-bold');
                    if (!titleElement) return;
                    
                    const title = titleElement.getAttribute('title')?.trim();
                    const url = 'https://online.depo.lv' + titleElement.getAttribute('href');
                    
                    // Get price information - now using the new price structure
                    const priceElement = element.querySelector('.whitespace-nowrap.font-extrabold');
                    if (!priceElement) return;
                    
                    const priceText = priceElement.textContent.trim();
                    const price = priceText.replace(/[^\d,.]*/g, '').trim();
                    
                    // Format price with comma
                    const numPrice = Number(price);
                    const formattedPrice = numPrice.toFixed(2).replace('.', ',') + ' €';
                    
                    // Get image URL - updated selector for new structure
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
                            image,
                            store: 'DEPO'
                        });
                    }
                } catch (error) {
                    console.error('Error processing DEPO product:', error);
                }
            });
            
            return items;
        });

        console.log(`DEPO: Found ${products.length} products for keyword: ${keyword}`);
        return products;
        
    } catch (error) {
        console.error('Error scraping DEPO:', error);
        return [];
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (error) {
                console.error('Error closing DEPO page:', error);
            }
        }
    }
}

// Scraping function for Prof.lv
async function scrapeProf(keyword) {
    let page = null;
    try {
        page = await getStealthPage();
        console.log('Prof.lv: Starting search for:', keyword);
        
        await page.goto(`https://prof.lv/catalogsearch/result/?q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for either products or no results indicator
        try {
            await Promise.race([
                page.waitForSelector('.products.list.items.product-items.row', { timeout: 5000 }),
                page.waitForSelector('.empty-search-results', { timeout: 5000 })
            ]);
        } catch (timeoutError) {
            console.log('Prof.lv: Timeout waiting for results, checking if any products exist');
        }

        // Extract products
        const products = await page.evaluate(() => {
            const items = [];
            // Updated selector to match Prof.lv's structure
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

                    // Get image URL - updated selector for Prof.lv's image structure
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
                    
                    // Only add products that have all required information
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

        const results = products.map(product => ({
            store: 'Prof.lv',
            ...product
        }));

        console.log(`Prof.lv: Found ${results.length} products for keyword: ${keyword}`);
        return results;

    } catch (error) {
        console.error('Error scraping Prof.lv:', error);
        return [];
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (error) {
                console.error('Error closing Prof.lv page:', error);
            }
        }
    }
}

// Scraping function for Buvserviss
async function scrapeBuvserviss(keyword) {
    let page = null;
    try {
        page = await getStealthPage();
        console.log('Buvserviss: Starting search for:', keyword);
        
        await page.goto(`https://www.buvserviss.lv/site/search?search=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for products to load
        try {
            await Promise.race([
                page.waitForSelector('.products-list', { timeout: 5000 }),
                page.waitForSelector('.empty-state', { timeout: 5000 })
            ]);
        } catch (timeoutError) {
            console.log('Buvserviss: Timeout waiting for results');
            return [];
        }

        // Extract products
        const products = await page.evaluate(() => {
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

                    // Only add products that have all required information
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

        const results = products.map(product => ({
            store: 'Buvserviss',
            ...product
        }));

        console.log(`Buvserviss: Found ${results.length} products for keyword: ${keyword}`);
        return results;

    } catch (error) {
        console.error('Error scraping Buvserviss:', error);
        return [];
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (error) {
                console.error('Error closing Buvserviss page:', error);
            }
        }
    }
}

async function scrapeBuvniecibas(keyword) {
    const page = await getStealthPage();
    const results = [];
    
    try {
        await page.goto(`https://buvniecibas-abc.lv/lv/meklesana?query=${encodeURIComponent(keyword)}&search=`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for products to load
        await page.waitForSelector('.products.grid-view', { timeout: 5000 });

        // Extract products
        const products = await page.evaluate(() => {
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

        results.push(...products.map(product => ({
            store: 'Buvniecibas ABC',
            ...product
        })));

    } catch (error) {
        console.error('Buvniecibas ABC scraping error:', error.message);
    } finally {
        await page.close();
    }
    
    return results;
}

async function scrapeKruza(keyword) {
    const page = await getStealthPage();
    const results = [];
    
    try {
        await page.goto(`https://www.kruza.lv/site/search?query=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for products to load
        await page.waitForSelector('.product-list', { timeout: 5000 });

        // Extract products
        const products = await page.evaluate(() => {
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

        results.push(...products.map(product => ({
            store: 'Kruza',
            ...product
        })));

    } catch (error) {
        console.error('Kruza scraping error:', error.message);
    } finally {
        await page.close();
    }
    
    return results;
}

async function scrapeBau(keyword) {
    const page = await getStealthPage();
    const results = [];
    
    try {
        await page.goto(`https://bau24.lv/?subcats=Y&status=A&pshort=Y&pfull=Y&pname=Y&pkeywords=Y&search_performed=Y&q=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for any of these selectors to appear, indicating the page has loaded
        await Promise.race([
            page.waitForSelector('.mainbox-body', { timeout: 10000 }),
            page.waitForSelector('form[name^="product_form_"]', { timeout: 10000 }),
            page.waitForSelector('.product-title', { timeout: 10000 })
        ]).catch(() => {
            console.log('Initial selector wait timed out, proceeding anyway');
        });

        // Add a small delay using setTimeout wrapped in a Promise
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Extract products
        const products = await page.evaluate(() => {
            const items = [];
            // Select all product forms
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

                    // Get image URL - using the exact HTML structure from Bau24
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

        results.push(...products.map(product => ({
            store: 'Bau24',
            ...product
        })));

    } catch (error) {
        console.error('Bau24 scraping error:', error.message);
    } finally {
        await page.close();
    }
    
    return results;
}

async function scrapeBuvdarbiem(keyword) {
    const page = await getStealthPage();
    const results = [];
    
    try {
        await page.goto(`https://www.buvdarbiem.lv/precu-meklesana?search=${encodeURIComponent(keyword)}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for products to load
        await page.waitForSelector('.product-grid-list', { timeout: 5000 });

        // Extract products
        const products = await page.evaluate(() => {
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

        results.push(...products.map(product => ({
            store: 'Buvdarbiem.lv',
            ...product
        })));

    } catch (error) {
        console.error('Buvdarbiem.lv scraping error:', error.message);
    } finally {
        await page.close();
    }
    
    return results;
}

// Main scraping function that combines results from multiple stores
async function scrapeProduct(keyword, selectedStores = ['1a.lv', 'Ksenukai', 'Dateks', 'RD Veikals', 'Euronics', 'DEPO', 'Prof.lv', 'Buvserviss', 'Buvniecibas ABC', 'Kruza', 'Bau24', 'Buvdarbiem.lv']) {
    try {
        if (!browser) {
            await initBrowser();
        }

        const storeResults = {};
        
        // Initialize results for all selected stores
        selectedStores.forEach(store => {
            storeResults[store] = [];
        });
        
        // Create array of scraping functions with timeouts
        const scrapingPromises = selectedStores.map(async (store) => {
            try {
                let results = [];
                // Add timeout for each store
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Timeout for ${store}`)), 30000);
                });
                
                const scrapePromise = (async () => {
                    switch(store) {
                        case '1a.lv':
                            return await scrape1a(keyword);
                        case 'Ksenukai':
                            return await scrapeKsenukai(keyword);
                        case 'Dateks':
                            return await scrapeDateks(keyword);
                        case 'RD Veikals':
                            return await scrapeRdveikals(keyword);
                        case 'Euronics':
                            return await scrapeEuronics(keyword);
                        case 'DEPO':
                            return await scrapeDepo(keyword);
                        case 'Prof.lv':
                            return await scrapeProf(keyword);
                        case 'Buvserviss':
                            return await scrapeBuvserviss(keyword);
                        case 'Buvniecibas ABC':
                            return await scrapeBuvniecibas(keyword);
                        case 'Kruza':
                            return await scrapeKruza(keyword);
                        case 'Bau24':
                            return await scrapeBau(keyword);
                        case 'Buvdarbiem.lv':
                            return await scrapeBuvdarbiem(keyword);
                        default:
                            return [];
                    }
                })();
                
                results = await Promise.race([scrapePromise, timeoutPromise]);
                storeResults[store] = results || [];
                console.log(`${store}: Found ${results.length} results`);
            } catch (error) {
                console.error(`Error scraping ${store}:`, error.message);
                storeResults[store] = [];
            }
        });

        // Wait for all scraping to complete
        await Promise.all(scrapingPromises);
        
        // Combine all results
        const allResults = Object.values(storeResults).flat();
        console.log('Total results found:', allResults.length);
        return allResults;

    } catch (error) {
        console.error('Scraping error:', error);
        return [];
    }
}

// API endpoint for product search
app.post('/api/search', async (req, res) => {
    try {
        const { keyword, selectedStores } = req.body;
        if (!keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }
        
        const results = await scrapeProduct(keyword, selectedStores);
        console.log(`Found ${results.length} total results for keyword: ${keyword}`);
        res.json({ results });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cleanup browser on server shutdown
process.on('SIGINT', async () => {
    if (browser) {
        await browser.close();
    }
    process.exit();
});

app.listen(PORT, async () => {
    await initBrowser();
    console.log(`Server is running on port ${PORT}`);
}); 