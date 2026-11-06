/**
 * Currency Conversion Utilities
 * Fetches live exchange rates and handles conversion to/from INR
 */

// Fallback exchange rates (used if API fails)
const FALLBACK_RATES_TO_INR: Record<string, number> = {
  'INR': 1,        // Indian Rupee (base currency)
  'USD': 83.12,    // US Dollar
  'EUR': 90.45,    // Euro
  'GBP': 105.23,   // British Pound
  'AED': 22.63,    // UAE Dirham
  'SGD': 61.84,    // Singapore Dollar
  'AUD': 55.32,    // Australian Dollar
  'CAD': 61.25,    // Canadian Dollar
  'JPY': 0.57,     // Japanese Yen
  'CNY': 11.52,    // Chinese Yuan
};

// Cache for exchange rates
interface RateCache {
  rates: Record<string, number>;
  timestamp: number;
  expiresAt: number;
}

let rateCache: RateCache | null = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Fetch live exchange rates from API
 * Uses exchangerate-api.com with INR as base currency
 */
async function fetchLiveRates(): Promise<Record<string, number>> {
  try {
    // Using exchangerate-api.com free tier (no API key required for basic usage)
    // Alternative: use frankfurter.app if this doesn't work
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert rates to "X currency = Y INR" format
    const rates: Record<string, number> = { 'INR': 1 };
    
    for (const [currency, rate] of Object.entries(data.rates)) {
      if (typeof rate === 'number') {
        // Since API gives us 1 INR = X currency, we need inverse for our format
        rates[currency] = 1 / (rate as number);
      }
    }
    
    return rates;
  } catch (error) {
    console.warn('Failed to fetch live exchange rates, using fallback rates:', error);
    return FALLBACK_RATES_TO_INR;
  }
}

/**
 * Get current exchange rates (from cache or fetch new)
 */
async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  
  // Return cached rates if still valid
  if (rateCache && now < rateCache.expiresAt) {
    return rateCache.rates;
  }
  
  // Fetch new rates
  const rates = await fetchLiveRates();
  
  // Update cache
  rateCache = {
    rates,
    timestamp: now,
    expiresAt: now + CACHE_DURATION
  };
  
  return rates;
}

/**
 * Get cached rates synchronously (returns fallback if no cache)
 * Use this when you need rates immediately without async
 */
function getCachedRatesSync(): Record<string, number> {
  if (rateCache && Date.now() < rateCache.expiresAt) {
    return rateCache.rates;
  }
  return FALLBACK_RATES_TO_INR;
}

/**
 * Convert amount from any currency to INR (synchronous - uses cached rates)
 * @param amount - Amount in source currency
 * @param fromCurrency - Source currency code (USD, EUR, etc.)
 * @returns Amount in INR
 */
export function convertToINR(amount: number, fromCurrency: string): number {
  if (!amount || amount === 0) return 0;
  
  const rates = getCachedRatesSync();
  const rate = rates[fromCurrency.toUpperCase()];
  
  if (!rate) {
    console.warn(`Exchange rate not found for ${fromCurrency}, using fallback`);
    const fallbackRate = FALLBACK_RATES_TO_INR[fromCurrency.toUpperCase()];
    return fallbackRate ? Math.round(amount * fallbackRate * 100) / 100 : amount;
  }
  
  return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert amount from any currency to INR (async - ensures fresh rates)
 * Use this for displaying conversions to ensure today's exchange rate is used
 * @param amount - Amount in source currency
 * @param fromCurrency - Source currency code (USD, EUR, etc.)
 * @returns Promise<Amount in INR>
 */
export async function convertToINRAsync(amount: number, fromCurrency: string): Promise<number> {
  if (!amount || amount === 0) return 0;
  
  // Ensure we have fresh rates (respects 1-hour cache)
  const rates = await getExchangeRates();
  const rate = rates[fromCurrency.toUpperCase()];
  
  if (!rate) {
    console.warn(`Exchange rate not found for ${fromCurrency}, using fallback`);
    const fallbackRate = FALLBACK_RATES_TO_INR[fromCurrency.toUpperCase()];
    return fallbackRate ? Math.round(amount * fallbackRate * 100) / 100 : amount;
  }
  
  return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert amount from INR to any currency
 * @param amountInINR - Amount in INR
 * @param toCurrency - Target currency code (USD, EUR, etc.)
 * @returns Amount in target currency
 */
export function convertFromINR(amountInINR: number, toCurrency: string): number {
  if (!amountInINR || amountInINR === 0) return 0;
  
  const rates = getCachedRatesSync();
  const rate = rates[toCurrency.toUpperCase()];
  
  if (!rate) {
    console.warn(`Exchange rate not found for ${toCurrency}, using fallback`);
    const fallbackRate = FALLBACK_RATES_TO_INR[toCurrency.toUpperCase()];
    return fallbackRate ? Math.round((amountInINR / fallbackRate) * 100) / 100 : amountInINR;
  }
  
  return Math.round((amountInINR / rate) * 100) / 100; // Round to 2 decimal places
}

/**
 * Preload exchange rates (call this when app loads)
 * This ensures rates are cached before user needs them
 */
export async function preloadExchangeRates(): Promise<void> {
  try {
    await getExchangeRates();
    console.log('✓ Exchange rates loaded successfully');
  } catch (error) {
    console.warn('Failed to preload exchange rates:', error);
  }
}

/**
 * Force refresh exchange rates (bypasses cache)
 */
export async function refreshExchangeRates(): Promise<void> {
  rateCache = null; // Clear cache
  await getExchangeRates();
}

/**
 * Get exchange rate for a currency relative to INR
 * @param currencyCode - Currency code (USD, EUR, etc.)
 * @returns Exchange rate to INR, or 1 if not found
 */
export function getExchangeRate(currencyCode: string): number {
  const rates = getCachedRatesSync();
  return rates[currencyCode.toUpperCase()] || FALLBACK_RATES_TO_INR[currencyCode.toUpperCase()] || 1;
}

/**
 * Get all supported currency codes
 * @returns Array of currency codes
 */
export function getSupportedCurrencies(): string[] {
  const rates = getCachedRatesSync();
  return Object.keys(rates);
}

/**
 * Check if a currency is supported
 * @param currencyCode - Currency code to check
 * @returns True if supported, false otherwise
 */
export function isCurrencySupported(currencyCode: string): boolean {
  const rates = getCachedRatesSync();
  return currencyCode.toUpperCase() in rates;
}

/**
 * Get rate cache information
 * @returns Cache info including age and expiry
 */
export function getRateCacheInfo(): { 
  cached: boolean; 
  age: number; 
  expiresIn: number;
  source: 'live' | 'fallback';
} {
  if (!rateCache) {
    return { cached: false, age: 0, expiresIn: 0, source: 'fallback' };
  }
  
  const now = Date.now();
  const age = now - rateCache.timestamp;
  const expiresIn = rateCache.expiresAt - now;
  const isLive = rateCache.rates !== FALLBACK_RATES_TO_INR;
  
  return {
    cached: true,
    age: Math.floor(age / 1000), // in seconds
    expiresIn: Math.max(0, Math.floor(expiresIn / 1000)), // in seconds
    source: isLive ? 'live' : 'fallback'
  };
}

/**
 * Format currency amount with symbol
 * @param amount - Amount to format
 * @param currencyCode - Currency code
 * @returns Formatted string with currency symbol
 */
export function formatCurrencyWithSymbol(amount: number, currencyCode: string): string {
  const symbols: Record<string, string> = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'AED': 'AED',
    'SGD': 'S$',
    'AUD': 'A$',
    'CAD': 'C$',
    'JPY': '¥',
    'CNY': '¥',
  };
  
  const symbol = symbols[currencyCode.toUpperCase()] || currencyCode;
  return `${symbol} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get the display symbol for a currency code (used by compact/reporting formatters)
 * @param currencyCode - Currency code
 * @returns Currency symbol or the code itself with a trailing space
 */
export function getCurrencyDisplaySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'AED': 'AED ',
    'SGD': 'S$',
    'AUD': 'A$',
    'CAD': 'C$',
    'JPY': '¥',
    'CNY': '¥',
  };
  return symbols[(currencyCode || 'INR').toUpperCase()] || `${currencyCode} `;
}

/**
 * Format an amount in a compact, entity-currency-aware form for dashboard/reporting tiles.
 * INR uses the Indian lakh/crore numbering system; all other currencies use K/M abbreviations.
 * @param amount - Amount to format
 * @param currencyCode - Currency code of the active entity (defaults to INR)
 * @returns Compact formatted currency string, e.g. "₹1.2Cr", "€45.0K", "$3.4M"
 */
export function formatCompactCurrency(amount: number, currencyCode: string = 'INR'): string {
  const code = (currencyCode || 'INR').toUpperCase();
  const symbol = getCurrencyDisplaySymbol(code);
  const v = amount || 0;

  if (code === 'INR') {
    if (v >= 10000000) return `${symbol}${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `${symbol}${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `${symbol}${(v / 1000).toFixed(1)}K`;
    return `${symbol}${Math.round(v)}`;
  }

  if (v >= 1000000) return `${symbol}${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${symbol}${(v / 1000).toFixed(1)}K`;
  return `${symbol}${Math.round(v)}`;
}

/**
 * Convert amount from any source currency to target currency
 * @param amount - Source amount
 * @param fromCurrency - Source currency code (USD, EUR, INR, etc.)
 * @param toCurrency - Target currency code (INR, EUR, USD, etc.)
 * @returns Amount converted to target currency
 */
export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  if (!amount || amount === 0) return 0;
  const from = (fromCurrency || 'INR').toUpperCase();
  const to = (toCurrency || 'INR').toUpperCase();
  if (from === to) return amount;
  
  // Convert from -> INR
  const inrAmount = from === 'INR' ? amount : convertToINR(amount, from);
  // Convert INR -> to
  if (to === 'INR') return inrAmount;
  return convertFromINR(inrAmount, to);
}
