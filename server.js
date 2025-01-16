const express = require('express');
const cors = require('cors');
require('dotenv').config();

const scrapingManager = require('./scrapers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API endpoint for product search
app.post('/api/search', async (req, res) => {
    try {
        const { keyword, selectedStores } = req.body;
        if (!keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }
        
        const results = await scrapingManager.scrapeProducts(keyword, selectedStores);
        console.log(`Found ${results.length} total results for keyword: ${keyword}`);
        res.json({ results });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to get available stores
app.get('/api/stores', (req, res) => {
    const stores = scrapingManager.getAvailableStores();
    res.json({ stores });
});

// Initialize the scraping manager and start the server
async function startServer() {
    try {
        await scrapingManager.initialize();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 