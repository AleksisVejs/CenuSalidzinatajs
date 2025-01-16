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
                '--disable-web-security'
            ],
            timeout: 30000
        });
        
        isInitialized = true;
        browserDisconnected = false;

        // Handle browser disconnection
        browser.on('disconnected', async () => {
            if (activePages.size > 0) {
                console.log('Browser disconnected with active pages, reinitializing...');
                isInitialized = false;
                browserDisconnected = true;
                browser = null;
                await initBrowser();
            } else {
                console.log('Browser disconnected, cleaning up...');
                isInitialized = false;
                browserDisconnected = true;
                browser = null;
                await closeBrowser();
            }
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

// Function to ensure browser is ready with retry
async function ensureBrowser() {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        try {
            if (!browser || !isInitialized || browserDisconnected) {
                await initBrowser();
            }
            return browser;
        } catch (error) {
            attempts++;
            console.error(`Browser initialization failed (attempt ${attempts}/${maxAttempts}):`, error.message);
            if (attempts === maxAttempts) {
                throw error;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
    }
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

                    // Check for products
                    const element = await page.$(selector);
                    if (element) {
                        clearInterval(checkInterval);
                        resolve(element);
                        return;
                    }

                    // Check if page has finished loading
                    const readyState = await page.evaluate(() => document.readyState);
                    if (readyState === 'complete') {
                        // If page is loaded and we still don't have the element, resolve with null
                        const finalCheck = await page.$(selector);
                        if (!finalCheck) {
                            clearInterval(checkInterval);
                            resolve(null);
                            return;
                        }
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
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Error handling
        page.on('error', async (err) => {
            console.error('Page crashed:', err);
            activePages.delete(page);
            await page.close().catch(() => {});
        });
        
        page.on('close', () => {
            activePages.delete(page);
        });
        
        return page;
    } catch (error) {
        console.error('Error creating page:', error);
        throw error;
    }
}

// Add retry utility function at the top level
async function retry(operation, maxAttempts = 3, delay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
    throw lastError;
}

// Base scraper class for common functionality
class BaseScraper {
    constructor(name, baseUrl) {
        this.name = name;
        this.baseUrl = baseUrl;
    }

    async scrape(keyword, runningTotal = 0) {
        let page = null;
        try {
            // Get new page
            page = await getStealthPage();
            
            // Navigate to search URL
            const searchUrl = this.getSearchUrl(keyword);
            await page.goto(searchUrl, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });
            
            // Wait for products
            await this.waitForProducts(page);
            
            // Check for results
            const hasResults = await this.checkForResults(page);
            if (!hasResults) {
                console.log(`${this.name}: No results found`);
                return [];
            }

            // Extract products
            const products = await this.extractProducts(page);
            const count = products?.length || 0;
            console.log(`${this.name}: Found ${count} results. Total so far: ${runningTotal + count}`);
            return products || [];
            
        } catch (error) {
            console.error(`${this.name} scraping error:`, error.message);
            return [];
        } finally {
            if (page) {
                try {
                    activePages.delete(page);
                    if (!page.isClosed()) {
                        await page.close().catch(() => {});
                    }
                } catch (e) {}
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