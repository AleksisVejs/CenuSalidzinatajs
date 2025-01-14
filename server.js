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

                if (title && price && url) {
                    items.push({ 
                        title, 
                        price,
                        url
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


                if (title && price && url) {
                    items.push({ 
                        title, 
                        price,
                        url
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
                        const priceText = priceElement.textContent.trim()
                            .replace(/[^\d,.]*/g, '')  // Remove everything except digits, comma and dot
                            .replace(',', '.')  // Replace comma with dot for parsing
                            .trim();
                        // Format price with comma
                        const numPrice = Number(priceText);
                        price = numPrice.toFixed(2).replace('.', ',') + ' €';
                    }

                    // Get URL
                    const linkElement = element.querySelector('.imp');
                    const url = linkElement ? 'https://www.dateks.lv' + linkElement.getAttribute('href') : null;

                    // Get additional specs
                    const specs = {};
                    element.querySelectorAll('.fv').forEach(spec => {
                        const key = spec.querySelector('.k')?.textContent.replace(':', '').trim();
                        const value = spec.querySelector('.v')?.textContent.trim();
                        if (key && value) {
                            specs[key] = value;
                        }
                    });

                    // Get availability
                    const availElement = element.querySelector('.avail');
                    const availability = availElement ? availElement.textContent.trim() : null;

                    if (title && price && url) {
                        items.push({
                            title,
                            price,
                            url,
                            specs,
                            availability
                        });
                    }
                } catch (error) {
                    console.error('Error processing product:', error);
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

        // Extract products
        const products = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.product.js-product').forEach(element => {
                try {
                    // Get title and brand
                    const titleElement = element.querySelector('.product__title a');
                    const title = titleElement ? titleElement.textContent.trim() : null;
                    
                    // Get price
                    const priceElement = element.querySelector('.price b');
                    let price = null;
                    if (priceElement) {
                        const priceText = priceElement.textContent.trim()
                            .replace(/[^\d,.]*/g, '')  // Remove everything except digits, comma and dot
                            .replace(',', '.')  // Replace comma with dot for parsing
                            .trim();
                        // Format price with comma
                        const numPrice = Number(priceText);
                        price = numPrice.toFixed(2).replace('.', ',') + ' €';
                    }
                    
                    // Get URL
                    const linkElement = element.querySelector('.overlay');
                    let url = null;
                    if (linkElement) {
                        const href = linkElement.getAttribute('href');
                        // Remove any leading slashes and properly join URL parts
                        url = href ? `https://www.rdveikals.lv/${href.replace(/^\/+/, '')}` : null;
                    }

                    if (title && price && url) {
                        items.push({
                            title,
                            price,
                            url
                        });
                    }
                } catch (error) {
                    console.error('Error processing RD Veikals product:', error);
                }
            });
            return items;
        });

        results.push(...products.map(product => ({
            store: 'RD Veikals',
            ...product
        })));

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
            document.querySelectorAll('.product-card.vertical').forEach(productCard => {
                try {
                    // Get title from the product name link
                    const titleElement = productCard.querySelector('.product_name .product-card__title');
                    const title = titleElement ? titleElement.textContent.trim() : null;

                    // Get price - need to find the actual price element
                    const priceAttribute = productCard.getAttribute('data-product-price');
                    let price = null;
                    if (priceAttribute) {
                        const numPrice = Number(priceAttribute);
                        price = numPrice.toFixed(2).replace('.', ',') + ' €';
                    }

                    // Get URL from the product name link
                    const linkElement = productCard.querySelector('.product_name');
                    const url = linkElement ? linkElement.getAttribute('href') : null;
                    // Make sure URL is absolute
                    const fullUrl = url ? (url.startsWith('http') ? url : `https://www.euronics.lv${url}`) : null;

                    if (title && price && fullUrl) {
                        items.push({
                            title,
                            price,
                            url: fullUrl
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

// Main scraping function that combines results from multiple stores
async function scrapeProduct(keyword, selectedStores = ['1a.lv', 'Ksenukai', 'Dateks', 'RD Veikals', 'Euronics']) {
    try {
        if (!browser) {
            await initBrowser();
        }

        const scrapingPromises = [];
        
        if (selectedStores.includes('1a.lv')) {
            scrapingPromises.push(scrape1a(keyword));
        }
        if (selectedStores.includes('Ksenukai')) {
            scrapingPromises.push(scrapeKsenukai(keyword));
        }
        if (selectedStores.includes('Dateks')) {
            scrapingPromises.push(scrapeDateks(keyword));
        }
        if (selectedStores.includes('RD Veikals')) {
            scrapingPromises.push(scrapeRdveikals(keyword));
        }
        if (selectedStores.includes('Euronics')) {
            scrapingPromises.push(scrapeEuronics(keyword));
        }

        const results = await Promise.all(scrapingPromises);
        return results.flat();

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
        res.json(results);
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