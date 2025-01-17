// Regular expressions for extracting product information
const DIMENSIONS_REGEX = /(?:(\d+(?:[,.]\d+)?)\s*(?:x|х|×|by|\*|-)\s*){2,3}\s*(?:mm|cm|m|in|inch|"|ft|feet|′)?/i;
const WEIGHT_REGEX = /(?:\d+(?:[,.]\d+)?)\s*(?:kg|g|t|lb|oz|gr|кг)\b/i;
const VOLUME_REGEX = /(?:\d+(?:[,.]\d+)?)\s*(?:l|ml|cl|m³|m3|л|мл)\b/i;
const POWER_REGEX = /(?:\d+(?:[,.]\d+)?)\s*(?:w|kw|mw|hp|v|volt|watts)\b/i;
const SIZE_REGEX = /(?:\d+(?:[,.]\d+)?)\s*(?:gb|tb|mb|pb|гб|тб|мб)\b/i;

// Improved brand recognition patterns for construction materials
const BRAND_REGEX = /(?:^|\b)(?:Samsung|Apple|iPhone|LG|Sony|PlayStation|PS5|PS4|Xbox|Microsoft|Philips|Panasonic|Dell|HP|Lenovo|Asus|Acer|Bosch|Siemens|Electrolux|Whirlpool|AEG|Zanussi|Miele|Makita|DeWalt|Milwaukee|Hilti|Metabo|Knauf|Paroc|Isover|Rockwool|Weber|Vetonit|Sakret|Sadolin|Kerama\s+Marazzi|Ceresit|Baumit|Caparol|[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]+)*)(?:\s+(?:Professional|Pro|Home|Plus|Premium|Extra))?\b/i;

// Brand aliases for normalization
const BRAND_ALIASES = {
    'IPHONE': 'APPLE',
    'WEBER.VETONIT': 'WEBER',
    'VETONIT': 'WEBER',
    'KNAUF INSULATION': 'KNAUF',
    'SAINT GOBAIN': 'ISOVER',
    'SAINT-GOBAIN': 'ISOVER',
    'PS5': 'PLAYSTATION',
    'PS4': 'PLAYSTATION',
    'PLAYSTATION 5': 'PLAYSTATION',
    'PLAYSTATION 4': 'PLAYSTATION',
    'XBOX SERIES': 'XBOX',
    'PAROC OWENS CORNING': 'PAROC',
    'ROCKWOOL ROCKMIN': 'ROCKWOOL',
    'ISOVER SAINT-GOBAIN': 'ISOVER'
};

// Model number patterns for different categories
const MODEL_PATTERNS = [
    // Gaming Consoles (e.g., PS5, Xbox Series X)
    /(?:PlayStation\s*5|PS5|Xbox\s*Series\s*[XS])\s*(?:Digital\s*Edition)?/i,
    // TVs (e.g., OLED55C1, QN65QN90A)
    /(?:(?:OLED|QLED|QN|UN)\s*\d{2,3}[A-Z]\d[A-Z]*(?:PUB|AUA)?)/i,
    // Monitors (e.g., 27GP850, S28AG700)
    /(?:[A-Z]?\d{2}[A-Z]+\d{3,4}(?:-[A-Z])?|[A-Z]{2,3}\d{2}[A-Z]+\d{3})/i,
    // Construction materials - specific product codes
    /(?:TP\s*115|KL-?37|(?:EXTRA|ULTRA|SUPER|PREMIUM|STANDARD|BASIC)\s*(?:PLUS|ROCK)?|ROTBAND(?:\s*PLUS)?|MP-?75|OAD|CC|(?:PRIM\s*)?801|VH|3000|BINDO\s*\d+|PLAZA\s*(?:GREY|GRAY))/i,
    // Electronics (e.g., Galaxy S21, iPhone 13 Pro)
    /(?:(?:GALAXY\s*)?[A-Z]+(?:\d+[A-Z]*)+(?:\s*(?:ULTRA|PLUS|PRO|MAX))?(?:-[A-Z0-9]+)*)/,
    // Appliances (e.g., WAV28L90, KGN36VLED)
    /(?:[A-Z]{2,}\d+[A-Z0-9]*)/,
    // Tools and Hardware (e.g., DCD778, GSB 18V-55)
    /(?:[A-Z]{2,3}[-\s]?\d+(?:V|W)?-?\d*)/,
    // Generic product codes
    /(?:(?:[A-Z]+-)?[A-Z0-9]{3,}(?:-[A-Z0-9]+)*)/,
    // Version/Series numbers
    /(?:v\d+(?:\.\d+)*|\d+\.\d+(?:\.\d+)*)/i
];

// Common words to ignore in similarity calculation
const IGNORE_WORDS = new Set([
    // English common words
    'the', 'with', 'and', 'or', 'in', 'at', 'on', 'for', 'to', 'of', 'by', 'up', 'new',
    // Units and measurements
    'mm', 'cm', 'm', 'kg', 'g', 't', 'lb', 'oz', 'l', 'ml', 'w', 'kw', 'v', 'gb', 'tb', 'mb',
    'inch', 'inches', 'ft', 'feet', 'watts', 'volt', 'volts', 'size', 'weight', 'length',
    // Colors
    'black', 'white', 'red', 'blue', 'green', 'silver', 'gold', 'grey', 'gray', 'yellow',
    'melns', 'balts', 'sarkans', 'zils', 'zaļš',
    // Common product descriptors
    'new', 'original', 'genuine', 'premium', 'professional', 'basic', 'standard', 'plus',
    'pro', 'max', 'mini', 'ultra', 'super', 'extra', 'lite', 'light', 'heavy', 'duty',
    // Latvian common words and product descriptors
    'ar', 'no', 'un', 'par', 'priekš', 'uz', 'pie', 'no', 'līdz', 'jauns', 'oriģināls',
    'akmens', 'vate', 'siltumizolācija', 'izolācija', 'minerālvate',
    'java', 'masa', 'apmetums', 'ģipša', 'dekoratīvais', 'iekšdarbu', 'ārdarbiem',
    'grīdas', 'sienas', 'āra', 'iekšdarbu', 'pašizlīdzinošā', 'izlīdzināšanas'
]);

// Product attribute weights for similarity calculation
const WEIGHTS = {
    model: 0.45,        // Increased weight for model numbers
    brand: 0.25,        // Important but not as critical as model
    specs: 0.20,        // Combined specs (dimensions, weight, etc.)
    words: 0.10         // Reduced weight for remaining words
};

/**
 * Normalizes a product code/model number
 * @param {string} code - Product code to normalize
 * @returns {string} - Normalized code
 */
function normalizeProductCode(code) {
    // Special cases for gaming consoles
    const consoleMatches = code.match(/(?:PlayStation\s*5|PS5|Xbox\s*Series\s*[XS])\s*(?:Digital\s*Edition)?/i);
    if (consoleMatches) {
        return consoleMatches[0]
            .replace(/PlayStation\s*5/i, 'PS5')
            .replace(/\s+/g, '')
            .toUpperCase();
    }

    // Special cases for TVs
    const tvMatches = code.match(/(?:OLED|QLED|QN|UN)\s*\d{2,3}[A-Z]\d[A-Z]*(?:PUB|AUA)?/i);
    if (tvMatches) {
        return tvMatches[0]
            .replace(/\s+/g, '')
            .replace(/(?:PUB|AUA)$/i, '')
            .toUpperCase();
    }

    // Special cases for monitors
    const monitorMatches = code.match(/[A-Z]?\d{2}[A-Z]+\d{3,4}(?:-[A-Z])?|[A-Z]{2,3}\d{2}[A-Z]+\d{3}/i);
    if (monitorMatches) {
        return monitorMatches[0]
            .replace(/\s+/g, '')
            .replace(/-/g, '')
            .toUpperCase();
    }

    // Special cases for construction materials
    const constructionMatches = code.match(/(?:TP\s*115|KL-?37|(?:EXTRA|ULTRA|SUPER|PREMIUM|STANDARD|BASIC)\s*(?:PLUS|ROCK)?|ROTBAND(?:\s*PLUS)?|MP-?75|OAD|CC|BINDO\s*\d+|PLAZA\s*(?:GREY|GRAY))/i);
    if (constructionMatches) {
        // Special case for Rotband products
        if (code.toUpperCase().includes('ROTBAND')) {
            return 'ROTBAND';
        }
        // Special case for Bindo products
        if (code.toUpperCase().includes('BINDO')) {
            return code.match(/BINDO\s*\d+/i)[0].replace(/\s+/g, '').toUpperCase();
        }
        // Special case for Plaza products
        if (code.toUpperCase().includes('PLAZA')) {
            return 'PLAZA';
        }
        return constructionMatches[0]
            .replace(/\s+/g, '')
            .replace(/-/g, '')
            .toUpperCase();
    }

    // Special cases for phones
    const phoneMatches = code.match(/(?:(?:GALAXY|IPHONE)\s*(?:[A-Z]\d+|(?:\d+\s*(?:PRO|PLUS|ULTRA|MAX)?))|S\d+\s*(?:ULTRA|PLUS)?)/i);
    if (phoneMatches) {
        return phoneMatches[0]
            .replace(/\s+/g, '')
            .replace(/GALAXY/i, 'S')
            .toUpperCase();
    }

    // Special cases for power tools
    const toolMatches = code.match(/[A-Z]{2,3}[-\s]?\d+[A-Z]?\d*(?:-[A-Z0-9]+)?/i);
    if (toolMatches) {
        return toolMatches[0]
            .replace(/\s+/g, '')
            .replace(/-/g, '')
            .toUpperCase();
    }

    // General normalization
    return code
        .replace(/[\s-]+/g, '')      // Remove spaces and hyphens
        .replace(/[OО]/g, '0')       // Replace O with 0
        .replace(/[Il]/g, '1')       // Replace I/l with 1
        .toUpperCase();
}

/**
 * Extracts and normalizes dimensions from a product title with improved handling
 * @param {string} title - Product title
 * @returns {Object|null} - Normalized dimensions with labels or null if not found
 */
function extractDimensions(title) {
    const match = title.match(DIMENSIONS_REGEX);
    if (!match) return null;
    
    // Extract numbers and convert to mm if needed
    const numbers = match[0].match(/\d+(?:[,.]\d+)?/g)
        .map(n => {
            const value = parseFloat(n.replace(',', '.'));
            if (match[0].toLowerCase().includes('cm')) return value * 10;
            if (match[0].toLowerCase().includes('m')) return value * 1000;
            return value;
        });
    
    // Sort dimensions by value for consistent ordering
    const sortedDims = [...numbers].sort((a, b) => a - b);
    
    // For insulation materials, try to identify thickness
    const isInsulation = title.toLowerCase().match(/(?:vate|wool|insulation|izolācija)/i);
    if (isInsulation && numbers.length === 3) {
        // Thickness is usually the smallest dimension
        return {
            thickness: sortedDims[0],
            width: sortedDims[1],
            length: sortedDims[2],
            raw: numbers,
            sorted: sortedDims,
            unit: match[0].toLowerCase().includes('cm') ? 'cm' : 
                  match[0].toLowerCase().includes('m') ? 'm' : 'mm'
        };
    }
    
    return {
        raw: numbers,
        sorted: sortedDims,
        unit: match[0].toLowerCase().includes('cm') ? 'cm' : 
              match[0].toLowerCase().includes('m') ? 'm' : 'mm'
    };
}

/**
 * Compares two sets of dimensions with improved tolerance handling
 * @param {Object} dims1 - First set of dimensions
 * @param {Object} dims2 - Second set of dimensions
 * @param {boolean} isInsulation - Whether the product is insulation material
 * @returns {number} - Similarity score between 0 and 1
 */
function compareDimensions(dims1, dims2, isInsulation = false) {
    if (!dims1 || !dims2) return 0;
    if (!dims1.sorted || !dims2.sorted) return 0;
    if (dims1.sorted.length !== dims2.sorted.length) return 0;
    
    // For insulation materials with identified thickness
    if (isInsulation && dims1.thickness && dims2.thickness) {
        // Thickness must match exactly or be within 1mm for standard sizes
        const thicknessDiff = Math.abs(dims1.thickness - dims2.thickness);
        if (thicknessDiff > 1) return 0;
        
        // Width and length can have 5% tolerance
        const widthDiff = Math.abs(dims1.width - dims2.width) / Math.max(dims1.width, dims2.width);
        const lengthDiff = Math.abs(dims1.length - dims2.length) / Math.max(dims1.length, dims2.length);
        
        if (widthDiff <= 0.05 && lengthDiff <= 0.05) {
            return 1 - (widthDiff + lengthDiff) / 4; // Score based on how close the match is
        }
        return 0;
    }
    
    // For other products or when dimensions aren't labeled
    const differences = dims1.sorted.map((dim, i) => {
        const diff = Math.abs(dim - dims2.sorted[i]) / Math.max(dim, dims2.sorted[i]);
        // More lenient tolerance for larger dimensions
        const tolerance = dim > 1000 ? 0.1 : 0.05;
        return diff <= tolerance ? 1 - (diff / tolerance) : 0;
    });
    
    return differences.reduce((sum, score) => sum + score, 0) / differences.length;
}

/**
 * Extracts and normalizes weight from a product title
 * @param {string} title - Product title
 * @returns {number|null} - Normalized weight in kg or null if not found
 */
function extractWeight(title) {
    const match = title.match(WEIGHT_REGEX);
    if (!match) return null;
    
    const value = parseFloat(match[0].match(/\d+(?:[,.]\d+)?/)[0].replace(',', '.'));
    const unit = match[0].match(/[a-z]+$/i)[0].toLowerCase();
    
    // Convert to kg
    switch (unit) {
        case 'g': return value / 1000;
        case 't': return value * 1000;
        case 'lb': return value * 0.45359237;
        default: return value; // kg
    }
}

/**
 * Extracts model number from a product title
 * @param {string} title - Product title
 * @returns {string|null} - Model number or null if not found
 */
function extractModel(title) {
    // Remove specifications and common words
    const cleanTitle = title
        .replace(DIMENSIONS_REGEX, '')
        .replace(WEIGHT_REGEX, '')
        .replace(VOLUME_REGEX, '')
        .replace(POWER_REGEX, '')
        .replace(SIZE_REGEX, '')
        .replace(/\b(?:new|original|genuine)\b/gi, '');
    
    // Try each model pattern
    for (const pattern of MODEL_PATTERNS) {
        const match = cleanTitle.match(pattern);
        if (match) {
            return normalizeProductCode(match[0]);
        }
    }
    
    return null;
}

/**
 * Extracts brand name from a product title
 * @param {string} title - Product title
 * @returns {string|null} - Brand name or null if not found
 */
function extractBrand(title) {
    const match = title.match(BRAND_REGEX);
    if (!match) return null;
    
    // Normalize brand name
    let brand = match[0].toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
    
    // Apply brand aliases
    return BRAND_ALIASES[brand] || brand;
}

/**
 * Calculates similarity between two strings using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j - 1][i] + 1,
                matrix[j][i - 1] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }
    
    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len2][len1] / maxLen;
}

/**
 * Extracts significant words from a product title
 * @param {string} title - Product title
 * @returns {Set<string>} - Set of significant words
 */
function extractSignificantWords(title) {
    return new Set(
        title.toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
            .split(/\s+/)
            .filter(word => 
                word.length > 2 && 
                !IGNORE_WORDS.has(word) &&
                !word.match(/^\d+$/)
            )
    );
}

/**
 * Calculates word similarity between two sets of words
 * @param {Set<string>} words1 - First set of words
 * @param {Set<string>} words2 - Second set of words
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateWordSimilarity(words1, words2) {
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
}

/**
 * Extracts specifications from a product title
 * @param {string} title - Product title
 * @returns {Object} - Extracted specifications
 */
function extractSpecifications(title) {
    return {
        dimensions: extractDimensions(title),
        weight: extractWeight(title),
        volume: extractVolume(title),
        power: extractPower(title),
        size: extractSize(title)
    };
}

/**
 * Extracts volume information
 * @param {string} title - Product title
 * @returns {number|null} - Normalized volume in liters
 */
function extractVolume(title) {
    const match = title.match(VOLUME_REGEX);
    if (!match) return null;
    
    const value = parseFloat(match[0].match(/\d+(?:[,.]\d+)?/)[0].replace(',', '.'));
    const unit = match[0].match(/[a-zа-я³3]+$/i)[0].toLowerCase();
    
    switch (unit) {
        case 'ml':
        case 'cl': return value / 100;
        case 'm³':
        case 'm3': return value * 1000;
        default: return value; // liters
    }
}

/**
 * Extracts power information
 * @param {string} title - Product title
 * @returns {number|null} - Normalized power in watts
 */
function extractPower(title) {
    const match = title.match(POWER_REGEX);
    if (!match) return null;
    
    const value = parseFloat(match[0].match(/\d+(?:[,.]\d+)?/)[0].replace(',', '.'));
    const unit = match[0].match(/[a-z]+$/i)[0].toLowerCase();
    
    switch (unit) {
        case 'kw': return value * 1000;
        case 'mw': return value * 1000000;
        case 'hp': return value * 745.7;
        case 'v':
        case 'volt':
        case 'volts': return null; // Voltage is not power
        default: return value; // watts
    }
}

/**
 * Extracts storage size information
 * @param {string} title - Product title
 * @returns {number|null} - Normalized size in GB
 */
function extractSize(title) {
    const match = title.match(SIZE_REGEX);
    if (!match) return null;
    
    const value = parseFloat(match[0].match(/\d+(?:[,.]\d+)?/)[0].replace(',', '.'));
    const unit = match[0].match(/[a-zа-я]+$/i)[0].toLowerCase();
    
    switch (unit) {
        case 'tb':
        case 'тб': return value * 1024;
        case 'mb':
        case 'мб': return value / 1024;
        case 'pb': return value * 1024 * 1024;
        default: return value; // GB
    }
}

/**
 * Compares specifications between two products
 * @param {Object} specs1 - First product specifications
 * @param {Object} specs2 - Second product specifications
 * @param {boolean} isInsulation - Whether the products are insulation materials
 * @returns {number} - Similarity score between 0 and 1
 */
function compareSpecifications(specs1, specs2, isInsulation = false) {
    let totalScore = 0;
    let totalWeight = 0;
    
    // Compare dimensions if both have them
    if (specs1.dimensions && specs2.dimensions) {
        totalScore += compareDimensions(specs1.dimensions, specs2.dimensions, isInsulation) * 0.4;
        totalWeight += 0.4;
    }
    
    // Compare other specifications
    const compareValue = (val1, val2) => {
        if (!val1 || !val2) return 0;
        const diff = Math.abs(val1 - val2) / Math.max(val1, val2);
        return diff <= 0.05 ? 1 : 1 - diff; // 5% tolerance
    };
    
    if (specs1.weight && specs2.weight) {
        totalScore += compareValue(specs1.weight, specs2.weight) * 0.2;
        totalWeight += 0.2;
    }
    
    if (specs1.volume && specs2.volume) {
        totalScore += compareValue(specs1.volume, specs2.volume) * 0.15;
        totalWeight += 0.15;
    }
    
    if (specs1.power && specs2.power) {
        totalScore += compareValue(specs1.power, specs2.power) * 0.15;
        totalWeight += 0.15;
    }
    
    if (specs1.size && specs2.size) {
        totalScore += compareValue(specs1.size, specs2.size) * 0.1;
        totalWeight += 0.1;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Calculates similarity score between two product titles
 * @param {string} title1 - First product title
 * @param {string} title2 - Second product title
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateTitleSimilarity(title1, title2) {
    // Extract all attributes
    const model1 = extractModel(title1);
    const model2 = extractModel(title2);
    const brand1 = extractBrand(title1);
    const brand2 = extractBrand(title2);
    const specs1 = extractSpecifications(title1);
    const specs2 = extractSpecifications(title2);
    const words1 = extractSignificantWords(title1);
    const words2 = extractSignificantWords(title2);
    
    // For construction materials, require exact model match
    if (brand1 && brand2 && 
        (brand1.match(/(?:KNAUF|SAKRET|WEBER)/i) || 
         brand2.match(/(?:KNAUF|SAKRET|WEBER)/i))) {
        if (model1 !== model2) {
            return 0;
        }
    }
    
    // Calculate individual similarity scores
    const modelScore = model1 && model2 ? (model1 === model2 ? 1 : calculateStringSimilarity(model1, model2)) : 0;
    const brandScore = brand1 && brand2 ? (brand1 === brand2 ? 1 : 0) : 0;
    const specsScore = compareSpecifications(specs1, specs2);
    const wordScore = calculateWordSimilarity(words1, words2);
    
    // Calculate weighted average
    let totalScore = 
        modelScore * WEIGHTS.model +
        brandScore * WEIGHTS.brand +
        specsScore * WEIGHTS.specs +
        wordScore * WEIGHTS.words;
    
    // Apply bonuses
    if (model1 && model2 && model1 === model2) {
        totalScore *= 1.5; // 50% bonus for exact model match
    }
    
    if (brand1 && brand2 && brand1 === brand2) {
        totalScore *= 1.3; // 30% bonus for same brand
    }
    
    // Bonus for matching specifications
    const hasMatchingSpecs = Object.keys(specs1).some(key => 
        specs1[key] && specs2[key] && 
        Math.abs(specs1[key] - specs2[key]) / Math.max(specs1[key], specs2[key]) <= 0.05
    );
    
    if (hasMatchingSpecs) {
        totalScore *= 1.2; // 20% bonus for matching specs
    }
    
    return Math.min(1, totalScore);
}

/**
 * Determines if two product titles are similar enough to be grouped with improved matching
 * @param {string} title1 - First product title
 * @param {string} title2 - Second product title
 * @returns {boolean} - True if products should be grouped together
 */
function isSimilarTitle(title1, title2) {
    const similarity = calculateTitleSimilarity(title1, title2);
    
    // Check if this is an insulation material
    const isInsulation = title1.toLowerCase().match(/(?:vate|wool|insulation|izolācija)/i) ||
                        title2.toLowerCase().match(/(?:vate|wool|insulation|izolācija)/i);
    
    // More lenient threshold for insulation materials
    const threshold = isInsulation ? 0.6 : 0.65;
    
    // Extract dimensions for both titles
    const dims1 = extractDimensions(title1);
    const dims2 = extractDimensions(title2);
    
    // If both have dimensions, they must match according to our criteria
    if (dims1 && dims2) {
        const dimMatch = compareDimensions(dims1, dims2, isInsulation);
        if (dimMatch === 0) return false; // Dimensions don't match
    }
    
    return similarity >= threshold;
}

/**
 * Gets a standardized name for construction materials with improved handling
 * @param {Object} product - Product with extracted attributes
 * @returns {string} - Standardized name
 */
function getConstructionMaterialName(product) {
    const parts = [];
    
    // Normalize the title for better extraction
    const normalizedTitle = product.title.toUpperCase()
        .replace(/[,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Add material type prefix for insulation
    if (normalizedTitle.match(/(?:VATE|WOOL|INSULATION|IZOLĀCIJA)/)) {
        if (normalizedTitle.match(/AKMENS|STONE|ROCK/)) {
            parts.push('AKMENS VATE');
        } else if (normalizedTitle.match(/STIKLA|GLASS/)) {
            parts.push('STIKLA VATE');
        } else if (normalizedTitle.match(/EKOVATE|ECO/)) {
            parts.push('EKOVATE');
        }
    }
    
    // Add brand
    if (product.brand) {
        // Don't repeat brand if it's already in the material type
        if (!parts.join(' ').includes(product.brand)) {
            parts.push(product.brand);
        }
    }
    
    // Add model if available and different from brand
    if (product.model) {
        const cleanModel = product.model
            .replace(/(?:PREMIUM|PLUS|EXTRA|PRO)\s*$/i, '')
            .replace(product.brand || '', '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Extract numeric part of model for consistent formatting
        const modelNum = cleanModel.match(/\d+/);
        const modelPrefix = cleanModel.replace(/\d+.*$/, '').trim();
        
        if (modelNum) {
            // Format as PREFIX + NUMBER (e.g., "LINIO 15" or "ULTRA 100")
            const formattedModel = modelPrefix ? `${modelPrefix} ${modelNum[0]}` : modelNum[0];
            if (!parts.join(' ').includes(formattedModel)) {
                parts.push(formattedModel);
            }
        } else if (cleanModel && !parts.join(' ').includes(cleanModel)) {
            parts.push(cleanModel);
        }
    }
    
    // Add product line suffix (PLUS, PREMIUM, etc.)
    const suffixMatch = normalizedTitle.match(/\b(PREMIUM|PLUS|EXTRA|PRO)\b/);
    if (suffixMatch && !parts.join(' ').includes(suffixMatch[1])) {
        parts.push(suffixMatch[1]);
    }
    
    // Add dimensions for insulation materials
    const dims = extractDimensions(product.title);
    if (dims && dims.sorted && dims.sorted.length === 3) {
        // Format dimensions consistently (smallest to largest)
        parts.push(`(${dims.sorted[0]}x${dims.sorted[1]}x${dims.sorted[2]}${dims.unit})`);
    }
    
    // Add weight if present
    const weightMatch = product.title.match(/(\d+)(?:\s*kg|\s*кг)/i);
    if (weightMatch) {
        parts.push(`(${weightMatch[1]}kg)`);
    }
    
    // Clean up the final name
    return parts.join(' ')
        .replace(/\s+/g, ' ')
        .replace(/(\w+)(\s+\1)+/g, '$1') // Remove duplicate words
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim();
}

/**
 * Gets a standardized name for electronics and appliances
 * @param {Object} product - Product with extracted attributes
 * @returns {string} - Standardized name
 */
function getElectronicsName(product) {
    const parts = [];
    
    // Add brand
    if (product.brand) parts.push(product.brand);
    
    // Add model based on category
    if (product.model) {
        // Skip model if it's the same as the brand
        if (product.model.toUpperCase() !== product.brand.toUpperCase()) {
            // For phones, clean up the model
            if (product.brand.match(/(?:APPLE|SAMSUNG)/i) && 
                product.model.match(/(?:IPHONE|GALAXY|S\d+)/i)) {
                const cleanModel = product.model
                    .replace(/GALAXY/i, '')
                    .replace(/IPHONE/i, '')
                    .trim();
                parts.push(cleanModel);
            }
            // For TVs, clean up the model
            else if (product.brand === 'LG' && product.model.match(/OLED\d+/i)) {
                parts.push(product.model.replace(/(?:PUB|AUA)$/i, ''));
            }
            // For power tools, clean up the model
            else if (product.brand.match(/(?:DEWALT|MAKITA|BOSCH)/i)) {
                parts.push(product.model.replace(/(?:-[A-Z0-9]+)+$/i, ''));
            }
            // For other products
            else {
                parts.push(product.model);
            }
        }
    }
    
    // Add specifications
    const specParts = [];
    
    // Add storage size for electronics
    if (product.specs.size && 
        !product.model?.match(/(?:WAV|KGN|WM|DCD)\d+/i)) { // Exclude appliance model numbers
        const size = product.specs.size;
        if (size >= 1024) {
            specParts.push(`${(size / 1024).toFixed(0)}TB`);
        } else {
            specParts.push(`${size}GB`);
        }
    }
    
    // Add weight for appliances and tools
    if (product.specs.weight && 
        !product.brand.match(/(?:APPLE|SAMSUNG|LENOVO|ASUS|LG)/i)) {
        const weight = product.specs.weight;
        if (product.brand.match(/(?:DEWALT|MAKITA|BOSCH)/i)) {
            // For power tools, only show weight if it's reasonable (less than 20kg)
            if (weight > 0 && weight < 20) {
                specParts.push(`${weight}kg`);
            }
        } else {
            if (weight < 0.1) {
                specParts.push(`${(weight * 1000).toFixed(0)}g`);
            } else if (weight >= 1000) {
                specParts.push(`${(weight / 1000).toFixed(1)}t`);
            } else {
                specParts.push(`${weight}kg`);
            }
        }
    }
    
    // Add power
    if (product.specs.power) {
        const power = product.specs.power;
        if (power >= 1000) {
            specParts.push(`${(power / 1000).toFixed(1)}kW`);
        } else {
            specParts.push(`${power}W`);
        }
    }
    
    // Add voltage for power tools
    if (product.brand.match(/(?:DEWALT|MAKITA|BOSCH)/i)) {
        const voltageMatch = product.title.match(/(\d+)\s*V\b/i);
        if (voltageMatch) {
            specParts.push(`${voltageMatch[1]}V`);
        }
    }
    
    // Add 5G indicator for phones
    if (product.brand.match(/(?:APPLE|SAMSUNG)/i) && 
        product.title.toLowerCase().includes('5g')) {
        specParts.push('5G');
    }
    
    // Add specifications in parentheses if any exist
    if (specParts.length > 0) {
        parts.push(`(${specParts.join(', ')})`);
    }
    
    return parts.join(' ');
}

/**
 * Gets a standardized name for a group of products with improved consistency
 * @param {Array<Object>} group - Array of product objects
 * @returns {string} - Standardized group name
 */
function getStandardizedGroupName(group) {
    if (!group || group.length === 0) return '';
    
    // Get all products' attributes
    const products = group.map(p => ({
        title: p.title,
        brand: extractBrand(p.title),
        model: extractModel(p.title),
        specs: extractSpecifications(p.title)
    }));
    
    // Get the base product (one with most complete information)
    const baseProduct = products.reduce((a, b) => {
        const aScore = Object.values(a.specs).filter(Boolean).length + (a.brand ? 1 : 0) + (a.model ? 1 : 0);
        const bScore = Object.values(b.specs).filter(Boolean).length + (b.brand ? 1 : 0) + (b.model ? 1 : 0);
        return aScore >= bScore ? a : b;
    });
    
    // Check if this is a construction material
    const isConstructionMaterial = baseProduct.brand && 
        (baseProduct.brand.match(/(?:ROCKWOOL|PAROC|KNAUF|ISOVER|WEBER|CERESIT|BAUMIT)/i) || 
         baseProduct.title.toLowerCase().match(/(?:vate|wool|insulation|izolācija|ģipškartons|java|cements)/));
    
    if (isConstructionMaterial) {
        const name = getConstructionMaterialName(baseProduct);
        // Clean up common issues in construction material names
        return name
            .replace(/\bLOKSN\b/g, '')
            .replace(/\bPLAKSN\b/g, '')
            .replace(/\bIEPAK\b/g, '')
            .replace(/\bM2\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    // For electronics and appliances
    return getElectronicsName(baseProduct);
}

function normalizeModelNumber(model) {
    return model.toLowerCase()
        .replace(/[-\s]/g, '')
        .replace(/^(paroc|knauf|kronospan|cemex|rockwool|isover|gyproc)/, ''); // Remove brand prefix
}

module.exports = {
    calculateTitleSimilarity,
    isSimilarTitle,
    getStandardizedGroupName,
    normalizeModelNumber
};
