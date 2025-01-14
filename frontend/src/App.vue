<template>
  <div id="app">
    <div class="container" :class="{ 'with-comparison': comparisonItems.length > 0 }">
      <h1>Price Comparison</h1>
      <div class="search-container">
        <div class="store-selection">
          <h2>Select Stores</h2>
          <div class="store-options">
            <label class="store-option" v-for="store in availableStores" :key="store">
              <input 
                type="checkbox" 
                :value="store" 
                v-model="selectedStores"
                :disabled="loading"
              >
              <span class="store-name">{{ store }}</span>
            </label>
          </div>
        </div>
        <div class="search-box">
          <i class="search-icon">🔍</i>
          <input 
            v-model="searchQuery" 
            @keyup.enter="searchProducts"
            placeholder="Enter product name..."
            class="search-input"
            :disabled="loading || selectedStores.length === 0"
          />
          <button 
            @click="searchProducts" 
            class="search-button" 
            :disabled="loading || selectedStores.length === 0"
          >
            <span v-if="loading" class="loading-text">
              <div class="button-spinner"></div>
              Searching...
            </span>
            <span v-else>Compare Prices</span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="loading-spinner"></div>
        <p>Searching across selected stores...</p>
      </div>

      <div v-if="error" class="error">
        <span class="error-icon">⚠️</span>
        <div class="error-message">
          {{ error }}
          <div v-if="storeErrors.length > 0" class="error-details">
            <div v-for="(err, index) in storeErrors" :key="index">
              {{ err }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="!loading && selectedStores.length === 0" class="empty-state">
        <i class="empty-icon">🏪</i>
        <p>Select stores to start comparing prices</p>
      </div>

      <div v-if="!loading && selectedStores.length > 0 && results.length === 0 && !error" class="empty-state">
        <i class="empty-icon">🔎</i>
        <p>Enter a product name to compare prices</p>
      </div>

      <div v-if="results.length > 0" class="results-controls">
        <div class="results-summary">
          <p>Found {{ filteredResults.length }} products from 
            <span>{{ 
              activeStores.length === 1 
                ? '1 store' 
                : `${activeStores.length} stores` 
            }}</span>
          </p>
          <div class="store-legend">
            <div 
              v-for="store in uniqueStores" 
              :key="store" 
              class="store-badge" 
              :class="[
                'store-' + store.toLowerCase().replace('.', '-'),
                { 'store-badge--inactive': !activeStoreFilters[store] }
              ]"
              @click="toggleStore(store)"
            >
              <span class="store-badge__name">{{ store }}</span>
              <span class="store-badge__count">{{ getStoreCount(store) }}</span>
            </div>
          </div>
        </div>
        <div class="filter-controls">
          <div class="price-filter">
            <label>Price range:</label>
            <div class="price-inputs">
              <div class="price-input-group">
                <input 
                  type="number" 
                  v-model.number="priceRange.min" 
                  placeholder="Min €"
                  min="0"
                  step="0.01"
                  class="price-input"
                  @input="validatePriceRange"
                />
              </div>
              <span class="price-separator">-</span>
              <div class="price-input-group">
                <input 
                  type="number" 
                  v-model.number="priceRange.max" 
                  placeholder="Max €"
                  min="0"
                  step="0.01"
                  class="price-input"
                  @input="validatePriceRange"
                />
              </div>
              <button 
                class="clear-price-filter" 
                @click="clearPriceRange"
                v-if="priceRange.min !== null || priceRange.max !== null"
              >
                ✕
              </button>
            </div>
          </div>
          <div class="sorting-controls">
            <label>Sort by:</label>
            <select v-model="sortOrder" class="sort-select">
              <option value="relevance">Relevance</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="filteredResults.length > 0" class="results">
        <div v-for="(group, index) in sortedGroupedResults" :key="index" class="result-group">
          <!-- Single item card -->
          <div v-if="group.length === 1" class="single-card">
            <div class="single-card-header">
              <h3>{{ group[0].title }}</h3>
              <span class="store-tag" :class="'store-' + group[0].store.toLowerCase().replace('.', '-')">
                {{ group[0].store }}
              </span>
            </div>
            <div class="single-card-content">
              <div class="price-section">
                <span class="price">{{ group[0].price }}</span>
              </div>
              <div class="card-actions">
                <button 
                  @click.stop="openProductUrl(group[0].url)" 
                  class="view-button"
                  :disabled="!group[0].url">
                  View Deal
                </button>
                <button 
                  @click="addToComparison(group[0])"
                  class="compare-button"
                  :class="{ 'in-comparison': isInComparison(group[0]) }"
                  :title="isInComparison(group[0]) ? 'Remove from comparison' : 'Add to comparison'">
                  {{ isInComparison(group[0]) ? '✓' : '+' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Stacked card for multiple items -->
          <div v-else class="stacked-card" :class="{ 'expanded': expandedGroups[index] }">
            <div class="stacked-card-header" @click="toggleGroup(index)">
              <div class="stacked-card-title">
                <h3>{{ getCombinedGroupName(group) }}</h3>
                <div class="stacked-card-badges">
                  <span class="store-count">{{ group.length }} items</span>
                  <span class="price-range">
                    {{ extractPrice(group[0].price) }}€ - {{ extractPrice(group[group.length-1].price) }}€
                  </span>
                </div>
              </div>
              <div class="stacked-card-preview">
                <div class="preview-stores">
                  <span 
                    v-for="store in getUniqueStores(group).slice(0, 3)" 
                    :key="store"
                    class="preview-store-tag"
                    :class="'store-' + store.toLowerCase().replace('.', '-')"
                  >
                    {{ store }}
                  </span>
                  <span v-if="getUniqueStores(group).length > 3" class="more-stores">
                    +{{ getUniqueStores(group).length - 3 }}
                  </span>
                </div>
                <i class="expand-icon" :class="{ 'rotated': expandedGroups[index] }">▼</i>
              </div>
            </div>
            <div class="stacked-card-content" v-show="expandedGroups[index]">
              <div class="result-cards">
                <div v-for="(result, rIndex) in group" :key="rIndex" 
                     class="result-card">
                  <div class="result-header">
                    <span class="store-tag" :class="'store-' + result.store.toLowerCase().replace('.', '-')">
                      {{ result.store }}
                    </span>
                    <span class="price">{{ result.price }}</span>
                  </div>
                  <div class="product-details">
                    <h4 class="product-title">{{ result.title }}</h4>
                  </div>
                  <div class="card-actions">
                    <button 
                      @click.stop="openProductUrl(result.url)" 
                      class="view-button"
                      :disabled="!result.url">
                      View Deal
                    </button>
                    <button 
                      @click="addToComparison(result)"
                      class="compare-button"
                      :class="{ 'in-comparison': isInComparison(result) }"
                      :title="isInComparison(result) ? 'Remove from comparison' : 'Add to comparison'">
                      {{ isInComparison(result) ? '✓' : '+' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="results.length > 0 && filteredResults.length === 0" class="empty-state">
        <i class="empty-icon">🔎</i>
        <p>No results match your current filters. Try selecting more stores!</p>
      </div>
    </div>

    <!-- Comparison Sidebar -->
    <div class="comparison-sidebar" :class="{ 'active': comparisonItems.length > 0 }">
      <div class="comparison-header">
        <h2>Comparison List</h2>
        <button @click="clearComparison" class="clear-comparison" v-if="comparisonItems.length > 0">
          Clear All
        </button>
      </div>
      <div class="comparison-items" v-if="comparisonItems.length > 0">
        <div v-for="(item, index) in comparisonItems" :key="index" class="comparison-item">
          <div class="comparison-item-header">
            <span class="store-tag" :class="'store-' + item.store.toLowerCase().replace('.', '-')">
              {{ item.store }}
            </span>
            <button @click="removeFromComparison(index)" class="remove-item">×</button>
          </div>
          <h4>{{ item.title }}</h4>
          <div class="comparison-item-price">{{ item.price }}</div>
          <button 
            @click="openProductUrl(item.url)" 
            class="view-button"
            :disabled="!item.url">
            View Deal
          </button>
        </div>
      </div>
      <div class="comparison-empty" v-else>
        <p>Add items to compare by clicking the + button on products</p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { reactive } from 'vue';

export default {
  name: 'App',
  data() {
    return {
      searchQuery: '',
      results: [],
      loading: false,
      error: null,
      storeErrors: [],
      sortOrder: 'relevance',
      activeStoreFilters: reactive({}),
      availableStores: ['1a.lv', 'Ksenukai', 'Dateks', 'RD Veikals', 'Euronics'],
      selectedStores: ['1a.lv', 'Ksenukai', 'Dateks', 'RD Veikals', 'Euronics'],
      expandedGroups: {},
      priceRange: {
        min: null,
        max: null
      },
      comparisonItems: []
    };
  },
  computed: {
    uniqueStores() {
      return [...new Set(this.results.map(r => r.store))];
    },
    activeStores() {
      return this.uniqueStores.filter(store => this.activeStoreFilters[store]);
    },
    filteredResults() {
      return this.results.filter(result => {
        // Store filter
        if (!this.activeStoreFilters[result.store]) return false;
        
        // Price filter
        const price = this.extractPrice(result.price);
        if (this.priceRange.min !== null && price < this.priceRange.min) return false;
        if (this.priceRange.max !== null && price > this.priceRange.max) return false;
        
        return true;
      });
    },
    sortedResults() {
      if (this.sortOrder === 'relevance') {
        // For relevance sorting, use title similarity to the search query
        return [...this.filteredResults].sort((a, b) => {
          // Calculate similarity scores
          const scoreA = this.calculateRelevanceScore(a.title, this.searchQuery);
          const scoreB = this.calculateRelevanceScore(b.title, this.searchQuery);
          return scoreB - scoreA; // Higher score first
        });
      }
      // Price sorting remains the same
      return [...this.filteredResults].sort((a, b) => {
        const priceA = this.extractPrice(a.price);
        const priceB = this.extractPrice(b.price);
        return this.sortOrder === 'price-asc' ? priceA - priceB : priceB - priceA;
      });
    },
    sortedGroupedResults() {
      if (this.sortOrder === 'relevance') {
        return this.groupSimilarItems(this.filteredResults);
      }
      return this.groupSimilarItems(this.sortedResults);
    }
  },
  methods: {
    async searchProducts() {
      if (!this.searchQuery.trim()) {
        this.error = 'Please enter a product name';
        return;
      }

      if (this.selectedStores.length === 0) {
        this.error = 'Please select at least one store';
        return;
      }

      this.loading = true;
      this.error = null;
      this.storeErrors = [];
      this.results = [];

      try {
        const response = await axios.post('http://localhost:3000/api/search', {
          keyword: this.searchQuery,
          selectedStores: this.selectedStores
        });
        
        this.results = response.data;

        // Check for store-specific errors
        const storeResults = {};
        this.selectedStores.forEach(store => {
          storeResults[store] = this.results.filter(r => r.store === store).length;
        });

        // Add store-specific error messages
        Object.entries(storeResults).forEach(([store, count]) => {
          if (count === 0) {
            if (store === 'Dateks') {
              this.storeErrors.push(`${store}: No products found or site unavailable.`);
            } else {
              this.storeErrors.push(`${store}: No products found.`);
            }
          }
        });

        if (this.storeErrors.length > 0 && this.results.length === 0) {
          this.error = 'Unable to fetch results from selected stores.';
        }

        // Initialize store filters
        this.uniqueStores.forEach(store => {
          this.activeStoreFilters[store] = true;
        });
      } catch (error) {
        this.error = 'An error occurred while searching. Please try again.';
        if (error.response?.data?.message) {
          this.storeErrors.push(error.response.data.message);
        }
        console.error('Search error:', error);
      } finally {
        this.loading = false;
      }
    },
    toggleStore(store) {
      this.activeStoreFilters[store] = !this.activeStoreFilters[store];
    },
    getStoreCount(store) {
      return this.results.filter(r => r.store === store).length;
    },
    openProductUrl(url) {
      if (!url) {
        console.error('No URL provided for product');
        return;
      }
      window.open(url, '_blank');
    },
    groupSimilarItems(items) {
      const groups = [];
      const used = new Set();

      items.forEach((item, index) => {
        if (used.has(index)) return;

        const group = [item];
        used.add(index);

        // Find similar items
        items.forEach((other, otherIndex) => {
          if (index !== otherIndex && !used.has(otherIndex) && this.isSimilarTitle(item.title, other.title)) {
            group.push(other);
            used.add(otherIndex);
          }
        });

        // Sort group by price
        group.sort((a, b) => {
          const priceA = this.extractPrice(a.price);
          const priceB = this.extractPrice(b.price);
          return priceA - priceB; // Always low to high within groups
        });

        groups.push(group);
      });

      return groups;
    },
    isSimilarTitle(title1, title2) {
      // Extract model numbers and core identifiers
      const getProductIdentifiers = (title) => {
        // Convert to lowercase and remove special characters
        const normalized = title.toLowerCase()
          .replace(/[^\w\s/-]/g, ' ')  // Keep hyphen and forward slash for model numbers
          .replace(/\s+/g, ' ')
          .trim();

        // Split into words
        const words = normalized.split(' ');
        
        // Find model numbers and significant identifiers
        const identifiers = {
          models: [],    // Store model numbers separately
          brands: [],    // Store brand names
          other: []      // Store other significant words
        };

        // Common model patterns
        const modelPatterns = [
          /^[a-z]+-?\d+/i,                    // Basic model (e.g., CR-2254, HD2581)
          /^[a-z]+\d+[a-z]+\d*/i,             // Mixed alphanumeric (e.g., HD9650XX)
          /^\d+[a-z]+\d*/i,                   // Number first (e.g., 65OLED873)
          /^[a-z]+-?\d+[-/]\d+/i,             // Range models (e.g., BT-150/160)
          /^[a-z]+-?\d+[a-z]*-?\d*/i          // Complex models (e.g., CR-2254A, HD2581/90)
        ];
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const nextWord = words[i + 1];
          
          // Check for model numbers
          const isModel = modelPatterns.some(pattern => pattern.test(word)) || 
                         (nextWord && /^[a-z]+$/i.test(word) && /^\d+$/i.test(nextWord));
          
          if (isModel) {
            // If it's a split model number (e.g., "CR 2254"), combine them
            if (nextWord && /^[a-z]+$/i.test(word) && /^\d+$/i.test(nextWord)) {
              identifiers.models.push(word + nextWord);
              i++; // Skip next word
            } else {
              identifiers.models.push(word);
            }
            continue;
          }
          
          // Check for brand names (usually capitalized words)
          if (word.length >= 2 && /^[A-Z]/i.test(word)) {
            identifiers.brands.push(word);
            continue;
          }
          
          // Include other significant words
          if (word.length >= 3 && !/^(the|and|for|with|bez|ar|un|vai)$/i.test(word)) {
            identifiers.other.push(word);
          }
        }
        
        return identifiers;
      };

      const id1 = getProductIdentifiers(title1);
      const id2 = getProductIdentifiers(title2);

      // First check model numbers - this is the most important match
      const modelMatch = id1.models.some(model1 => 
        id2.models.some(model2 => {
          // Clean up models for comparison
          const clean1 = model1.replace(/[-\s]/g, '').toLowerCase();
          const clean2 = model2.replace(/[-\s]/g, '').toLowerCase();
          return clean1 === clean2 || 
                 // Also check if one is contained within the other
                 clean1.includes(clean2) || 
                 clean2.includes(clean1);
        })
      );

      // If we have a model match, check brand match to confirm
      if (modelMatch) {
        // If either product has brand identifiers, at least one should match
        if (id1.brands.length > 0 && id2.brands.length > 0) {
          const brandMatch = id1.brands.some(brand1 =>
            id2.brands.some(brand2 => 
              brand1.toLowerCase() === brand2.toLowerCase() ||
              this.levenshteinDistance(brand1.toLowerCase(), brand2.toLowerCase()) <= 1
            )
          );
          return brandMatch;
        }
        // If no brands found, model match is sufficient
        return true;
      }

      // If no model match, products are not similar
      return false;
    },
    levenshteinDistance(str1, str2) {
      const m = str1.length;
      const n = str2.length;
      const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (str1[i - 1] === str2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1];
          } else {
            dp[i][j] = Math.min(
              dp[i - 1][j - 1] + 1,
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1
            );
          }
        }
      }

      return dp[m][n];
    },
    extractPrice(priceStr) {
      // Extract numeric value from price string (e.g., "12,54 €" -> 12.54)
      const number = priceStr.replace(/[^0-9,]/g, '').replace(',', '.');
      return parseFloat(number);
    },
    toggleGroup(index) {
      this.expandedGroups = {
        ...this.expandedGroups,
        [index]: !this.expandedGroups[index]
      };
    },
    getGroupStats(group) {
      const uniqueStores = new Set(group.map(item => item.store));
      return {
        uniqueStoreCount: uniqueStores.size,
        itemCount: group.length
      };
    },
    getUniqueStores(group) {
      return [...new Set(group.map(item => item.store))];
    },
    validatePriceRange() {
      // Only ensure min is not negative
      if (this.priceRange.min < 0) this.priceRange.min = 0;
    },
    clearPriceRange() {
      this.priceRange.min = null;
      this.priceRange.max = null;
    },
    getBaseProductName(title) {
      // Remove common color patterns and descriptive suffixes from title
      const patterns = [
        /,\s*[a-zA-Z]+\s+(?:color|krāsa)/i,
        /,\s*[a-zA-Z]+$/i,
        /\([a-zA-Z]+\)/i,
        /\s*-\s*[a-zA-Z\s]+$/i,
        /,\s*[a-zA-Z\s]+$/i
      ];
      
      let cleanTitle = title;
      patterns.forEach(pattern => {
        cleanTitle = cleanTitle.replace(pattern, '');
      });
      
      return cleanTitle.trim();
    },
    getCombinedGroupName(group) {
      // Get all cleaned titles
      const titles = group.map(item => {
        // First clean each title
        let title = item.title
          .replace(/\([^)]*\)/g, '') // Remove anything in parentheses
          .replace(/,.*$/, '')       // Remove anything after comma
          .trim();

        // Extract storage size if present
        const storageMatch = item.title.match(/(\d+)\s*(?:gb|tb)/i);
        const storage = storageMatch ? storageMatch[0] : '';

        // Remove common words and colors
        const commonWords = [
          'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'gold', 'silver', 'gray', 'grey', 'teal',
          'melns', 'melna', 'balts', 'balta', 'sarkans', 'sarkana', 'zils', 'zila', 'zaļš', 'zaļa', 'dzeltens', 'dzeltena',
          'rozā', 'violets', 'violeta', 'zelts', 'zelta', 'sudrabs', 'sudraba', 'pelēks', 'pelēka'
        ];
        
        commonWords.forEach(word => {
          title = title.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
        });

        // Add storage back if it exists
        return storage ? `${title.trim()} ${storage}` : title.trim();
      });

      // Find the most common words across all titles
      const wordFrequency = {};
      titles.forEach(title => {
        const words = title.split(/\s+/);
        words.forEach(word => {
          wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        });
      });

      // Get words that appear in at least half of the titles
      const commonWords = Object.entries(wordFrequency)
        .filter(([, count]) => count >= titles.length / 2)
        .map(([word]) => word)
        .sort((a, b) => wordFrequency[b] - wordFrequency[a]);

      // Reconstruct the title using common words in their original order
      const firstTitle = titles[0];
      const titleWords = firstTitle.split(/\s+/);
      const finalWords = titleWords.filter(word => commonWords.includes(word));

      // Add storage range if there are different storage variants
      const storages = [...new Set(group
        .map(item => item.title.match(/(\d+)\s*(?:gb|tb)/i)?.[0])
        .filter(Boolean))];
      
      if (storages.length > 1) {
        // Sort storages numerically
        storages.sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)[0]);
          const numB = parseInt(b.match(/\d+/)[0]);
          return numA - numB;
        });
        return `${finalWords.join(' ')} (${storages.join('/')})`;
      }

      return finalWords.join(' ');
    },
    calculateRelevanceScore(title, query) {
      // Normalize strings for comparison
      const normalizedTitle = title.toLowerCase();
      const normalizedQuery = query.toLowerCase();
      
      // Split into words
      const titleWords = normalizedTitle.split(/\s+/);
      const queryWords = normalizedQuery.split(/\s+/);
      
      let score = 0;
      
      // Check for exact matches first (highest priority)
      if (normalizedTitle.includes(normalizedQuery)) {
        score += 100;
      }
      
      // Check for model numbers (high priority)
      const modelPattern = /[a-z]+-?\d+[a-z-]?\d*/i;
      const titleModels = titleWords.filter(word => modelPattern.test(word));
      const queryModels = queryWords.filter(word => modelPattern.test(word));
      
      if (titleModels.length > 0 && queryModels.length > 0) {
        titleModels.forEach(titleModel => {
          queryModels.forEach(queryModel => {
            // Clean up models for comparison
            const cleanTitleModel = titleModel.replace(/[-\s]/g, '').toLowerCase();
            const cleanQueryModel = queryModel.replace(/[-\s]/g, '').toLowerCase();
            
            if (cleanTitleModel === cleanQueryModel) {
              score += 50;
            } else if (cleanTitleModel.includes(cleanQueryModel) || 
                       cleanQueryModel.includes(cleanTitleModel)) {
              score += 30;
            }
          });
        });
      }
      
      // Check for word matches (medium priority)
      queryWords.forEach(queryWord => {
        if (queryWord.length < 3) return; // Skip very short words
        
        titleWords.forEach(titleWord => {
          if (titleWord === queryWord) {
            score += 10;
          } else if (titleWord.includes(queryWord) || queryWord.includes(titleWord)) {
            score += 5;
          } else if (this.levenshteinDistance(titleWord, queryWord) <= 2) {
            score += 3;
          }
        });
      });
      
      // Bonus points for word order matching
      const consecutiveMatches = this.findConsecutiveMatches(titleWords, queryWords);
      score += consecutiveMatches * 15;
      
      return score;
    },
    
    findConsecutiveMatches(titleWords, queryWords) {
      let maxConsecutive = 0;
      let current = 0;
      
      for (let i = 0; i < titleWords.length - queryWords.length + 1; i++) {
        current = 0;
        for (let j = 0; j < queryWords.length; j++) {
          if (titleWords[i + j].includes(queryWords[j]) || 
              queryWords[j].includes(titleWords[i + j]) ||
              this.levenshteinDistance(titleWords[i + j], queryWords[j]) <= 2) {
            current++;
          } else {
            break;
          }
        }
        maxConsecutive = Math.max(maxConsecutive, current);
      }
      
      return maxConsecutive;
    },
    addToComparison(item) {
      const index = this.comparisonItems.findIndex(i => 
        i.store === item.store && 
        i.title === item.title && 
        i.price === item.price
      );
      
      if (index === -1) {
        this.comparisonItems.push(item);
      } else {
        this.comparisonItems.splice(index, 1);
      }
    },
    removeFromComparison(index) {
      this.comparisonItems.splice(index, 1);
    },
    clearComparison() {
      this.comparisonItems = [];
    },
    isInComparison(item) {
      return this.comparisonItems.some(i => 
        i.store === item.store && 
        i.title === item.title && 
        i.price === item.price
      );
    }
  }
};
</script>

<style>
:root {
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;
  --background-color: #f8fafc;
  --card-background: #ffffff;
  --text-color: #1e293b;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  --radius: 0.5rem;
}

#app {
  background-color: var(--background-color);
  min-height: 100vh;
  color: var(--text-color);
  font-family: system-ui, -apple-system, sans-serif;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
  position: relative;
}

h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 2rem;
  color: var(--text-color);
  text-align: center;
}

h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-color);
}

.search-container {
  background: var(--card-background);
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-bottom: 2rem;
}

.store-selection {
  margin-bottom: 1.5rem;
}

.store-options {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.store-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--background-color);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s;
}

.store-option:hover {
  background: var(--border-color);
}

.search-box {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-size: 1rem;
  transition: all 0.2s;
  background: var(--background-color);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.search-icon {
  position: absolute;
  margin-left: 0.75rem;
  color: var(--text-secondary);
}

.search-button {
  padding: 0.75rem 1.5rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-button:hover:not(:disabled) {
  background: var(--primary-hover);
}

.search-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  background: var(--card-background);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.results-controls {
  background: var(--card-background);
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.store-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.store-badge {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  background: var(--card-background);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.store-badge:hover {
  opacity: 1;
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

.store-badge--inactive {
  opacity: 1;
  background: var(--background-color);
  border-color: var(--border-color);
}

.store-badge--inactive .store-badge__name,
.store-badge--inactive .store-badge__count {
  color: var(--text-secondary);
}

.store-badge__name {
  font-weight: 500;
  transition: color 0.2s;
}

.store-badge__count {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.2s;
}

.store-badge--inactive .store-badge__count {
  background: var(--card-background);
}

/* Store-specific colors */
.store-1a-lv:not(.store-badge--inactive) {
  background: linear-gradient(135deg, #ff6b6b, #ff8787);
  color: white;
}

.store-ksenukai:not(.store-badge--inactive) {
  background: linear-gradient(135deg, #4ecdc4, #2eaf7d);
  color: white;
}

.store-dateks:not(.store-badge--inactive) {
  background: linear-gradient(135deg, #45b7d1, #3b7daa);
  color: white;
}

.store-rd-veikals:not(.store-badge--inactive) {
  background: linear-gradient(135deg, #ffd93d, #ff9f1c);
  color: white;
}

.store-euronics:not(.store-badge--inactive) {
  background: linear-gradient(135deg, #0066cc, #0052a3);
  color: white;
}

.sort-select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  background: var(--background-color);
  color: var(--text-color);
}

.result-group {
  margin-bottom: 1rem;
}

/* Card Styles */
.single-card {
  background: var(--card-background);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  transition: all 0.2s;
  overflow: hidden;
}

.single-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.single-card-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.single-card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
  flex: 1;
}

.single-card-content {
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.single-card-content .view-button {
  width: auto;
  min-width: 120px;
  white-space: nowrap;
}

.stacked-card {
  background: var(--card-background);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  transition: all 0.2s;
  overflow: hidden;
}

.stacked-card:hover {
  box-shadow: var(--shadow-lg);
}

.stacked-card-header {
  padding: 1.5rem;
  cursor: pointer;
  border-bottom: 1px solid transparent;
  transition: all 0.2s;
}

.stacked-card.expanded .stacked-card-header {
  border-bottom-color: var(--border-color);
  background: linear-gradient(to bottom, var(--background-color), var(--card-background));
}

.stacked-card-title {
  margin-bottom: 1rem;
}

.stacked-card-title h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 0.5rem 0;
}

.stacked-card-badges {
  display: flex;
  gap: 1rem;
  align-items: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.store-count {
  background: var(--background-color);
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-weight: 500;
}

.price-range {
  font-weight: 500;
}

.stacked-card-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-stores {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.preview-store-tag {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.more-stores {
  background: var(--background-color);
  color: var(--text-secondary);
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.stacked-card-content {
  padding: 1.5rem;
  background: var(--background-color);
}

.result-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.result-card {
  background: var(--card-background);
  border-radius: var(--radius);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: all 0.2s;
}

.result-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.store-tag {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.price {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
}

.view-button {
  padding: 0.75rem 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.view-button:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
}

.view-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.expand-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--background-color);
  border-radius: 50%;
  transition: all 0.2s;
}

.expand-icon.rotated {
  transform: rotate(180deg);
  background: var(--primary-color);
  color: white;
}

.error {
  background: #fee2e2;
  border: 1px solid #ef4444;
  color: #b91c1c;
  padding: 1rem;
  border-radius: var(--radius);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.error-details {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-start;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  width: 100%;
}

.price-filter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.price-filter label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.price-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.price-input-group {
  position: relative;
}

.price-input {
  width: 100px;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-size: 0.875rem;
  background: var(--background-color);
  color: var(--text-color);
  transition: all 0.2s;
}

.price-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.price-separator {
  color: var(--text-secondary);
  font-weight: 500;
}

.clear-price-filter {
  padding: 0.5rem;
  background: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-price-filter:hover {
  background: var(--border-color);
  color: var(--text-color);
}

.product-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.product-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
  margin: 0;
  line-height: 1.4;
}

.specs-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.spec-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-secondary);
}

.spec-label {
  font-weight: 500;
}

.spec-value {
  color: var(--text-color);
}

/* Layout adjustments */
.container.with-comparison {
  margin: 0 auto;
  padding: 2rem 1rem;
}

/* Comparison sidebar styles */
.comparison-sidebar {
  position: fixed;
  top: 0;
  left: -320px;
  width: 320px;
  height: 100vh;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(5px);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.comparison-sidebar.active {
  left: 0;
}

.comparison-header {
  padding: 1rem;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.comparison-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.clear-comparison {
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.comparison-items {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.comparison-item {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.comparison-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.comparison-item h4 {
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.comparison-item-price {
  font-size: 1.1rem;
  font-weight: bold;
  color: #2c3e50;
  margin: 0.5rem 0;
}

.remove-item {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #666;
  padding: 0.2rem 0.5rem;
}

.comparison-empty {
  padding: 2rem;
  text-align: center;
  color: #666;
}

/* Card action buttons */
.card-actions {
  display: flex;
  gap: 0.5rem;
}

.compare-button {
  padding: 0.5rem;
  min-width: 36px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.compare-button:hover:not(:disabled) {
  background: #e0e0e0;
}

.compare-button.in-comparison {
  background: #e8f5e9;
  color: #4caf50;
  border-color: #4caf50;
}

.compare-button.in-comparison:hover {
  background: #fbe9e7;
  color: #f44336;
  border-color: #f44336;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .container.with-comparison {
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  
  .comparison-sidebar {
    width: 100%;
    left: -100%;
  }
  
  .comparison-sidebar.active {
    left: 0;
  }
}
</style> 