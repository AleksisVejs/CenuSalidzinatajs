<template>
  <div id="app">
    <div class="container" :class="{ 'with-comparison': comparisonItems.length > 0 }">
      <h1>Price Comparison</h1>
      <div class="search-container">
        <div class="store-selection">
          <div class="store-header">
            <h2>Select Stores</h2>
            <button 
              @click="saveStoreSelection" 
              class="save-stores-button"
              :disabled="selectedStores.length === 0"
              :class="{ 'saved': showSaveSuccess }"
            >
              <span v-if="showSaveSuccess">
                <svg class="icon icon-check" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Saved!
              </span>
              <span v-else>Save Selection</span>
            </button>
          </div>
          <div class="store-categories">
            <div v-for="(stores, category) in storeCategories" :key="category" class="store-category">
              <div class="category-header">
                <h3 class="category-title">{{ category }}</h3>
                <label class="store-option select-all">
                  <input 
                    type="checkbox" 
                    :checked="isCategoryFullySelected(category)"
                    :indeterminate.prop="isCategoryPartiallySelected(category)"
                    @change="toggleCategory(category)"
                    :disabled="loading"
                  >
                  <span class="store-name">Select All</span>
                </label>
              </div>
              <div class="store-options">
                <label class="store-option" v-for="store in stores" :key="store">
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
          </div>
        </div>
        <div class="search-box">
          <div class="search-input-container">
            <svg class="icon icon-search" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              ref="searchInput"
              v-model="searchQuery" 
              @keyup.enter="searchProducts"
              @keydown="handleSearchKeydown"
              @focus="showSearchHistory = true"
              @blur="hideSearchHistory"
              placeholder="Enter product name... (Press '/' to focus)"
              class="search-input"
              :disabled="loading || selectedStores.length === 0"
            />
          </div>
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
        <svg class="icon icon-warning" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
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
        <svg class="icon icon-xl" viewBox="0 0 24 24">
          <path d="M3 3h18v18H3zM21 12H3M12 3v18"></path>
          <circle cx="12" cy="12" r="4"></circle>
        </svg>
        <p>Select stores to start comparing prices</p>
      </div>

      <div v-if="!loading && selectedStores.length > 0 && results.length === 0 && !error" class="empty-state">
        <svg class="icon icon-xl" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
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
                'store-' + normalizeStoreName(store),
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
          <div class="filter-section">
            <div class="filter-search">
              <label>Filter results:</label>
              <div class="filter-input-container">
                <svg class="icon icon-search" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input 
                  type="text" 
                  v-model="filterQuery"
                  placeholder="Type to filter results..."
                  class="filter-input"
                />
                <button 
                  v-if="filterQuery"
                  @click="filterQuery = ''"
                  class="clear-filter"
                  title="Clear filter"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div class="filter-section">
            <div class="price-filter">
              <label>Price range:</label>
              <div class="price-inputs">
                <div class="price-input-group">
                  <input 
                    type="number" 
                    v-model.number="priceRange.min" 
                    placeholder="Min"
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
                    placeholder="Max"
                    min="0"
                    step="0.01"
                    class="price-input"
                    @input="validatePriceRange"
                  />
                </div>
              </div>
              <button 
                class="clear-price-filter" 
                @click="clearPriceRange"
                v-if="priceRange.min !== null || priceRange.max !== null"
              >
                Clear price filter
              </button>
            </div>
          </div>

          <div class="filter-section">
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
      </div>

      <div v-if="filteredResults.length > 0" class="results">
        <div v-for="(group, index) in sortedGroupedResults" :key="index" class="result-group">
          <!-- Single item card -->
          <div v-if="group.length === 1" class="single-card">
            <div class="single-card-content">
              <div class="product-image-container">
                <img 
                  :src="group[0].image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48cGF0aCBkPSJNNDAgNDBINjBWNjBINDBWNDBaIiBmaWxsPSIjOTRBM0I4Ii8+PC9zdmc+'" 
                  :alt="group[0].title"
                  class="product-image"
                  @error="handleImageError"
                >
              </div>
              <div class="product-info">
                <div class="single-card-header">
                  <h3>{{ group[0].title }}</h3>
                  <span 
                    class="store-tag" 
                    :class="'store-' + normalizeStoreName(group[0].store)"
                  >
                    {{ group[0].store }}
                  </span>
                </div>
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
          </div>

          <!-- Stacked card for multiple items -->
          <div v-else class="stacked-card" :class="{ 'expanded': expandedGroups[index] }">
            <div class="stacked-card-header" @click="toggleGroup(index)">
              <div class="stacked-card-preview-image">
                <img 
                  :src="group[0].image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48cGF0aCBkPSJNNDAgNDBINjBWNjBINDBWNDBaIiBmaWxsPSIjOTRBM0I4Ii8+PC9zdmc+'" 
                  :alt="group[0].title"
                  class="preview-image"
                  @error="handleImageError"
                >
              </div>
              <div class="stacked-card-info">
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
                      :class="'store-' + normalizeStoreName(store)"
                    >
                      {{ store }}
                    </span>
                    <span v-if="getUniqueStores(group).length > 3" class="more-stores">
                      +{{ getUniqueStores(group).length - 3 }}
                    </span>
                  </div>
                  <svg class="icon icon-expand" :class="{ 'rotated': expandedGroups[index] }" viewBox="0 0 24 24">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div class="stacked-card-content" v-show="expandedGroups[index]">
              <div class="result-cards">
                <div v-for="(result, rIndex) in group" :key="rIndex" 
                     class="result-card">
                  <div class="result-image">
                    <img 
                      :src="result.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48cGF0aCBkPSJNNDAgNDBINjBWNjBINDBWNDBaIiBmaWxsPSIjOTRBM0I4Ii8+PC9zdmc+'" 
                      :alt="result.title"
                      class="product-image"
                      @error="handleImageError"
                    >
                  </div>
                  <div class="result-header">
                    <span 
                      class="store-tag" 
                      :class="'store-' + normalizeStoreName(result.store)"
                    >
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
        <svg class="icon icon-xl" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
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
            <span 
              class="store-tag" 
              :class="'store-' + normalizeStoreName(item.store)"
            >
              {{ item.store }}
            </span>
            <button @click="removeFromComparison(index)" class="remove-item">
              <svg class="icon icon-clear" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <h4>{{ item.title }}</h4>
          <div class="comparison-item-price">
            {{ item.price }}
          </div>
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
import './assets/styles.css';

export default {
  name: 'App',
  data() {
    return {
      searchQuery: '',
      filterQuery: '',
      originalSearchQuery: '',
      results: [],
      loading: false,
      error: null,
      storeErrors: [],
      sortOrder: 'relevance',
      activeStoreFilters: reactive({}),
      storeCategories: {
        'Electronics': ['1a.lv', 'Euronics', 'Dateks', 'RD Veikals'],
        'Home & Garden': ['DEPO', 'Ksenukai'],
        'Construction': ['Buvserviss', 'Buvniecibas ABC', 'Prof.lv', 'Kruza', 'Bau24', 'Buvdarbiem.lv'],
      },
      selectedStores: ['1a.lv', 'Ksenukai', 'Dateks', 'RD Veikals', 'Euronics', 'DEPO', 'Prof.lv', 'Buvserviss', 'Buvniecibas ABC', 'Kruza', 'Bau24', 'Buvdarbiem.lv'],
      expandedGroups: {},
      priceRange: {
        min: null,
        max: null
      },
      comparisonItems: [],
      searchHistory: [],
      showSearchHistory: false,
      sortedResults: [],
      showSaveSuccess: false
    };
  },
  computed: {
    availableStores() {
      return Object.values(this.storeCategories).flat();
    },
    uniqueStores() {
      return [...new Set(this.results.map(r => r.store))];
    },
    activeStores() {
      return this.uniqueStores.filter(store => this.activeStoreFilters[store]);
    },
    filteredResults() {
      const resultsToFilter = this.sortOrder === 'relevance' ? 
        this.sortedResults : this.results;

      // Normalize the filter query once
      const normalizedFilter = this.filterQuery.toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')  // Remove punctuation
        .replace(/\s+/g, ' ')                         // Normalize spaces
        .trim();

      return resultsToFilter.filter(result => {
        // Store filter
        if (!this.activeStoreFilters[result.store]) return false;
        
        // Price filter
        const price = this.extractPrice(result.price);
        if (this.priceRange.min !== null && price < this.priceRange.min) return false;
        if (this.priceRange.max !== null && price > this.priceRange.max) return false;
        
        // Additional filter query with normalized comparison
        if (normalizedFilter) {
          const normalizedTitle = result.title.toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')  // Remove punctuation
            .replace(/\s+/g, ' ')                         // Normalize spaces
            .trim();
          
          // Split into words for more flexible matching
          const filterWords = normalizedFilter.split(' ');
          return filterWords.every(word => normalizedTitle.includes(word));
        }
        
        return true;
      });
    },
    sortedAndFilteredResults() {
      if (this.sortOrder === 'relevance') return this.filteredResults;
      
      return [...this.filteredResults].sort((a, b) => {
        const priceA = this.extractPrice(a.price);
        const priceB = this.extractPrice(b.price);
        return this.sortOrder === 'price-asc' ? priceA - priceB : priceB - priceA;
      });
    },
    sortedGroupedResults() {
      return this.groupSimilarItems(this.sortedAndFilteredResults);
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
      this.originalSearchQuery = this.searchQuery;

      try {
        const response = await axios.post('http://localhost:3000/api/search', {
          keyword: this.searchQuery,
          selectedStores: this.selectedStores
        });

        // Update to handle the new response format
        this.results = response.data.results || [];
        
        // Sort results by relevance immediately after receiving them
        this.sortedResults = [...this.results].sort((a, b) => {
          const scoreA = this.calculateRelevanceScore(a.title, this.originalSearchQuery);
          const scoreB = this.calculateRelevanceScore(b.title, this.originalSearchQuery);
          return scoreB - scoreA;
        });

        // Add search query to history if not already present
        if (this.searchQuery.trim() && !this.searchHistory.includes(this.searchQuery)) {
          this.searchHistory.unshift(this.searchQuery);
          if (this.searchHistory.length > 10) {
            this.searchHistory.pop();
          }
          localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
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
      // Normalize titles
      const normalize = (text) => {
        return text.toLowerCase()
          .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const normalizedTitle1 = normalize(title1);
      const normalizedTitle2 = normalize(title2);

      // If titles are exactly the same, they're similar
      if (normalizedTitle1 === normalizedTitle2) {
        return true;
      }

      // Extract model numbers and product codes
      const extractProductInfo = (text) => {
        // Common product code patterns
        const patterns = [
          // Model numbers like "SM-A515" or "iPhone 13"
          /(?:[a-z]{1,4}[-]?[0-9]{2,4}[a-z]?)/i,
          // Product codes like "MWP22", "MQAG3"
          /\b[a-z]{2,4}[0-9]{2,4}[a-z]?\b/i,
          // Version numbers like "v2.0", "3rd gen"
          /\bv?[0-9](?:\.[0-9])?\b|\b[0-9](?:st|nd|rd|th)\s*gen(?:eration)?\b/i
        ];

        const matches = [];
        patterns.forEach(pattern => {
          const match = text.match(pattern);
          if (match) {
            matches.push(match[0].toLowerCase());
          }
        });
        return matches;
      };

      // Check if products share any model numbers or product codes
      const codes1 = extractProductInfo(normalizedTitle1);
      const codes2 = extractProductInfo(normalizedTitle2);
      
      if (codes1.length > 0 && codes2.length > 0) {
        // If both titles have codes, they must share at least one
        const sharedCodes = codes1.some(code => codes2.includes(code));
        if (!sharedCodes) {
          return false;
        }
      }

      // Extract key specifications
      const extractSpecs = (text) => {
        return {
          storage: text.match(/\b(?:\d+)\s*(?:gb|tb)\b/gi) || [],
          ram: text.match(/\b(?:\d+)\s*(?:gb)\s*ram\b/gi) || [],
          size: text.match(/\b(?:\d+(?:\.\d+)?)\s*(?:inch|"|''|cm)\b/gi) || [],
          resolution: text.match(/\b(?:\d+(?:\s*x\s*\d+)?)\s*(?:px|mp)\b/gi) || [],
          color: text.match(/\b(?:black|white|gold|silver|gray|blue|red|pink|green)\b/gi) || []
        };
      };

      const specs1 = extractSpecs(normalizedTitle1);
      const specs2 = extractSpecs(normalizedTitle2);

      // If both titles specify storage, they must match
      if (specs1.storage.length > 0 && specs2.storage.length > 0) {
        const storage1 = specs1.storage[0].toLowerCase();
        const storage2 = specs2.storage[0].toLowerCase();
        if (storage1 !== storage2) {
          return false;
        }
      }

      // If both titles specify RAM, they must match
      if (specs1.ram.length > 0 && specs2.ram.length > 0) {
        const ram1 = specs1.ram[0].toLowerCase();
        const ram2 = specs2.ram[0].toLowerCase();
        if (ram1 !== ram2) {
          return false;
        }
      }

      // If both titles specify size, they must match
      if (specs1.size.length > 0 && specs2.size.length > 0) {
        const size1 = specs1.size[0].toLowerCase();
        const size2 = specs2.size[0].toLowerCase();
        if (size1 !== size2) {
          return false;
        }
      }

      // Calculate word similarity
      const words1 = new Set(normalizedTitle1.split(' '));
      const words2 = new Set(normalizedTitle2.split(' '));
      
      // Find significant words (longer than 3 characters)
      const significantWords1 = [...words1].filter(word => word.length > 3);
      const significantWords2 = [...words2].filter(word => word.length > 3);
      
      // Calculate how many significant words are shared
      const sharedWords = significantWords1.filter(word => significantWords2.includes(word));
      const similarityScore = sharedWords.length / Math.max(significantWords1.length, significantWords2.length);

      // Require at least 60% similarity in significant words
      return similarityScore >= 0.6;
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
      // If all items in the group are identical, just return the first item's title
      if (group.every(item => item.title === group[0].title)) {
        return group[0].title;
      }

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
      const normalizedTitle = title.toLowerCase().trim();
      const normalizedQuery = query.toLowerCase().trim();
      
      let score = 0;
      
      // Exact match handling (highest priority)
      if (normalizedTitle === normalizedQuery) {
        score += 2000; // Perfect match
      }
      
      // Handle hyphenated and non-hyphenated versions (very high priority)
      const titleVariations = [
        normalizedTitle,
        normalizedTitle.replace(/\s*-\s*/g, ' '),  // Remove hyphens
        normalizedTitle.replace(/\s+/g, ' ')        // Normalize spaces
      ];
      
      const queryVariations = [
        normalizedQuery,
        normalizedQuery.replace(/\s*-\s*/g, ' '),  // Remove hyphens
        normalizedQuery.replace(/\s+/g, ' ')        // Normalize spaces
      ];
      
      // Check if any variation of the title starts with any variation of the query
      for (const titleVar of titleVariations) {
        for (const queryVar of queryVariations) {
          if (titleVar.startsWith(queryVar)) {
            score += 1500; // Title starts with query
            break;
          } else if (titleVar.includes(queryVar)) {
            score += 1000; // Title contains exact query
            break;
          }
        }
      }
      
      // Split into words (after handling exact matches)
      const titleWords = normalizedTitle.split(/[\s-]+/);
      const queryWords = normalizedQuery.split(/[\s-]+/);
      
      // Extract model numbers (high priority, but below exact matches)
      const modelPatterns = [
        /[a-z]+[-]?\d+(?:[a-z]|\s)?(?:\d+)?/gi,    // Basic model numbers
        /(?:[a-z]{1,4}[-]?)?\d{3,4}(?:[a-z]{1,2})?/gi, // Generic product codes
        /[a-z]+\s?\d+(?:[a-z]{1,2}|\s)?(?:\d+)?/gi  // Spaced model numbers
      ];
      
      let titleModels = [];
      let queryModels = [];
      
      modelPatterns.forEach(pattern => {
        const titleMatches = normalizedTitle.match(pattern) || [];
        const queryMatches = normalizedQuery.match(pattern) || [];
        titleModels.push(...titleMatches);
        queryModels.push(...queryMatches);
      });
      
      // Remove duplicates and normalize models
      titleModels = [...new Set(titleModels.map(m => m.replace(/[-\s]/g, '').toLowerCase()))];
      queryModels = [...new Set(queryModels.map(m => m.replace(/[-\s]/g, '').toLowerCase()))];
      
      // Model number matching
      if (queryModels.length > 0 && titleModels.length > 0) {
        queryModels.forEach(queryModel => {
          titleModels.forEach(titleModel => {
            if (titleModel === queryModel) {
              score += 500; // Exact model match
            } else if (titleModel.includes(queryModel)) {
              score += 250; // Partial model match
            } else if (queryModel.includes(titleModel)) {
              score += 150; // Model is part of query
            }
          });
        });
      }
      
      // Word order matching (medium-high priority)
      const consecutiveMatches = this.findConsecutiveMatches(titleWords, queryWords);
      score += consecutiveMatches * 50;
      
      // Individual word matching (medium priority)
      const importantWords = queryWords.filter(word => word.length > 2);
      importantWords.forEach(queryWord => {
        titleWords.forEach(titleWord => {
          if (titleWord === queryWord) {
            score += 30; // Exact word match
          } else if (titleWord.includes(queryWord) || queryWord.includes(titleWord)) {
            score += 15; // Partial word match
          } else if (this.levenshteinDistance(titleWord, queryWord) <= 2) {
            score += 5; // Similar word
          }
        });
      });
      
      // Position bonus (earlier matches are better)
      const firstMatchIndex = titleWords.findIndex(word => 
        queryWords.some(queryWord => word.includes(queryWord))
      );
      if (firstMatchIndex !== -1) {
        score += Math.max(0, 20 - firstMatchIndex * 2); // Decreasing bonus for later positions
      }
      
      // Length penalty (prefer shorter, more focused titles)
      const lengthPenalty = Math.max(0, titleWords.length - queryWords.length) * 5;
      score -= lengthPenalty;
      
      return score;
    },
    
    findConsecutiveMatches(titleWords, queryWords) {
      let maxConsecutive = 0;
      
      for (let i = 0; i < titleWords.length - queryWords.length + 1; i++) {
        let matches = 0;
        for (let j = 0; j < queryWords.length; j++) {
          const titleWord = titleWords[i + j];
          const queryWord = queryWords[j];
          
          if (titleWord === queryWord) {
            matches += 2;
          } else if (titleWord.includes(queryWord) || queryWord.includes(titleWord)) {
            matches += 1;
          } else if (this.levenshteinDistance(titleWord, queryWord) <= 2) {
            matches += 0.5;
          } else {
            break;
          }
        }
        maxConsecutive = Math.max(maxConsecutive, matches);
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
      
      // Save comparison items to localStorage
      this.saveComparisonItems();
    },
    loadSavedData() {
      // Load comparison items
      const savedComparison = localStorage.getItem('comparisonItems');
      if (savedComparison) {
        this.comparisonItems = JSON.parse(savedComparison);
      }
      
      // Load search history
      this.loadSearchHistory();

      // Load saved store selection
      const savedStores = localStorage.getItem('selectedStores');
      if (savedStores) {
        this.selectedStores = JSON.parse(savedStores);
      }
    },
    loadSearchHistory() {
      const savedHistory = localStorage.getItem('searchHistory');
      if (savedHistory) {
        this.searchHistory = JSON.parse(savedHistory);
      }
    },
    useHistoryItem(query) {
      this.searchQuery = query;
      this.showSearchHistory = false;
      this.searchProducts();
    },
    clearSearchHistory() {
      this.searchHistory = [];
      localStorage.removeItem('searchHistory');
    },
    handleSearchKeydown(e) {
      // Handle keyboard shortcuts
      if (e.key === 'Escape') {
        this.searchQuery = '';
        this.showSearchHistory = false;
      } else if (e.key === 'ArrowDown' && this.showSearchHistory && this.searchHistory.length > 0) {
        e.preventDefault();
        // Focus first history item
        this.$refs.historyList?.querySelector('.history-item')?.focus();
      }
    },
    hideSearchHistory() {
      window.setTimeout(() => {
        this.showSearchHistory = false
      }, 200)
    },
    removeFromComparison(index) {
      this.comparisonItems.splice(index, 1);
      this.saveComparisonItems();
    },
    clearComparison() {
      this.comparisonItems = [];
      this.saveComparisonItems();
    },
    isInComparison(item) {
      return this.comparisonItems.some(i => 
        i.store === item.store && 
        i.title === item.title && 
        i.price === item.price
      );
    },
    saveComparisonItems() {
      localStorage.setItem('comparisonItems', JSON.stringify(this.comparisonItems));
    },
    handleImageError(event) {
      event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48cGF0aCBkPSJNNDAgNDBINjBWNjBINDBWNDBaIiBmaWxsPSIjOTRBM0I4Ii8+PC9zdmc+';
    },
    saveStoreSelection() {
      localStorage.setItem('selectedStores', JSON.stringify(this.selectedStores));
      this.showSaveSuccess = true;
      setTimeout(() => {
        this.showSaveSuccess = false;
      }, 2000);
    },
    normalizeStoreName(store) {
      return store.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/\./g, '-')      // Replace dots with hyphens
        .replace(/\s/g, '-');     // Replace any remaining spaces
    },
    isCategoryFullySelected(category) {
      const categoryStores = this.storeCategories[category];
      return categoryStores.every(store => this.selectedStores.includes(store));
    },
    isCategoryPartiallySelected(category) {
      const categoryStores = this.storeCategories[category];
      const selectedCount = categoryStores.filter(store => this.selectedStores.includes(store)).length;
      return selectedCount > 0 && selectedCount < categoryStores.length;
    },
    toggleCategory(category) {
      const categoryStores = this.storeCategories[category];
      if (this.isCategoryFullySelected(category)) {
        // Deselect all stores in the category
        this.selectedStores = this.selectedStores.filter(store => !categoryStores.includes(store));
      } else {
        // Select all stores in the category
        const storesToAdd = categoryStores.filter(store => !this.selectedStores.includes(store));
        this.selectedStores = [...this.selectedStores, ...storesToAdd];
      }
    }
  },
  mounted() {
    this.loadSavedData();
    // Add keyboard event listener for the whole app
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        this.$refs.searchInput?.focus();
      }
    });
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }
};
</script>