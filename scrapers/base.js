const puppeteer = require('puppeteer');

let browser;
let isInitialized = false;
let activePages = new Set();
let browserDisconnected = false;

async function closeBrowser() {
    if (browser) {
        try {
            // Close all active pages first
            for (const page of activePages) {
                try {
                    if (!page.isClosed()) {
                        await page.close().catch(() => {});
                    }
                } catch (e) {
                    console.error('Error closing page:', e.message);
                }
            }
            activePages.clear();
            
            // Close the browser
            await browser.close().catch(() => {});
        } catch (e) {
            console.error('Error closing browser:', e.message);
        } finally {
            browser = null;
            isInitialized = false;
            browserDisconnected = false;
        }
    }
}

// Initialize browser instance
async function initBrowser() {
    try {
        // Always clean up first
        await closeBrowser();
        
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--memory-pressure-off',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-web-security',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-features=site-per-process',
                '--disable-features=TranslateUI',
                '--disable-extensions',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--mute-audio'
            ]
        });
        isInitialized = true;
        browserDisconnected = false;

        // Handle browser disconnection
        browser.on('disconnected', () => {
            console.log('Browser disconnected, marking for cleanup...');
            isInitialized = false;
            browserDisconnected = true;
        });

        // Handle process termination
        process.on('SIGINT', async () => {
            await closeBrowser();
            process.exit();
        });

        return browser;
    } catch (error) {
        console.error('Browser initialization error:', error);
        isInitialized = false;
        browser = null;
        browserDisconnected = false;
        throw error;
    }
}

// Function to ensure browser is ready
async function ensureBrowser() {
    if (!browser || !isInitialized || browserDisconnected) {
        return await initBrowser();
    }
    return browser;
}

// Function to validate page is still valid
async function isPageValid(page) {
    try {
        if (!page || page.isClosed()) return false;
        if (browserDisconnected) return false;
        
        // Try to execute a simple operation to verify connection
        await page.evaluate(() => true);
        return true;
    } catch (e) {
        return false;
    }
}

// Helper function to wait for selector with early success
async function waitForSelectorWithEarlySuccess(page, selector, timeout) {
    try {
        if (!await isPageValid(page)) {
            return null;
        }

        const result = await Promise.race([
            page.waitForSelector(selector, { timeout }),
            new Promise(async (resolve) => {
                const checkInterval = setInterval(async () => {
                    if (!await isPageValid(page)) {
                        clearInterval(checkInterval);
                        resolve(null);
                        return;
                    }
                    const element = await page.$(selector);
                    if (element) {
                        clearInterval(checkInterval);
                        resolve(element);
                    }
                }, 100);
                // Cleanup interval after timeout
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(null);
                }, timeout);
            })
        ]);
        return result;
    } catch (error) {
        return null;
    }
}

// Function to get a new page with stealth settings
async function getStealthPage() {
    try {
        await ensureBrowser();
        
        const page = await browser.newPage();
        activePages.add(page);
        
        // Basic page setup
        await Promise.all([
            page.setViewport({ width: 1920, height: 1080 }),
            page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
            page.setDefaultNavigationTimeout(60000)
        ]);
        
        // Error handling
        page.on('error', async (err) => {
            console.error('Page crashed:', err);
            activePages.delete(page);
            await page.close().catch(() => {});
        });
        
        page.on('close', () => {
            activePages.delete(page);
        });
        
        // Minimal request interception
        await page.setRequestInterception(true);
        page.on('request', request => {
            const resourceType = request.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        return page;
    } catch (error) {
        console.error('Error creating page:', error);
        throw error;
    }
}

// Base scraper class for common functionality
class BaseScraper {
    constructor(name, baseUrl) {
        this.name = name;
        this.baseUrl = baseUrl;
    }

    async scrape(keyword) {
        let page = null;
        try {
            // Get new page
            page = await getStealthPage();
            if (!page || !await isPageValid(page)) {
                throw new Error('Invalid page after creation');
            }

            const searchUrl = this.getSearchUrl(keyword);
            
            // Navigation
            await page.goto(searchUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            if (!await isPageValid(page)) {
                throw new Error('Page invalid after navigation');
            }

            // Wait for products
            await this.waitForProducts(page);
            if (!await isPageValid(page)) {
                throw new Error('Page invalid after waiting for products');
            }

            const hasResults = await this.checkForResults(page);
            if (!hasResults) {
                console.log(`${this.name}: No results found`);
                return [];
            }

            // Extract products
            const products = await Promise.race([
                this.extractProducts(page),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Product extraction timeout')), 20000)
                )
            ]);

            return products || [];
        } catch (error) {
            console.error(`${this.name} scraping error:`, error.message);
            if (browserDisconnected) {
                throw new Error('Browser disconnected during scraping');
            }
            return [];
        } finally {
            if (page) {
                try {
                    await page.close().catch(() => {});
                } catch (closeError) {
                    console.error(`Error closing page for ${this.name}:`, closeError.message);
                } finally {
                    activePages.delete(page);
                }
            }
        }
    }

    async navigateToSearch(page, keyword) {
        await retry(async () => {
            await page.goto(this.getSearchUrl(keyword), {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
        });
    }

    async handleCookies(page) {
        try {
            const cookieSelector = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
            await waitForSelectorWithEarlySuccess(page, cookieSelector, 5000);
            await page.click(cookieSelector);
        } catch (e) {
            // Cookie banner might not be present, continue
        }
    }

    // Methods to be implemented by child classes
    async waitForProducts(page) {
        throw new Error('waitForProducts must be implemented');
    }

    async checkForResults(page) {
        throw new Error('checkForResults must be implemented');
    }

    async extractProducts(page) {
        throw new Error('extractProducts must be implemented');
    }

    getSearchUrl(keyword) {
        throw new Error('getSearchUrl must be implemented');
    }
}

module.exports = {
    initBrowser,
    browser,
    BaseScraper,
    waitForSelectorWithEarlySuccess,
    getStealthPage,
    closeBrowser,
    ensureBrowser
}; 