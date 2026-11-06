import { supabase, isSupabaseConfigured } from '../config/supabase';
import type { ExchangeRateApiResponse, CurrencyConversion } from '../types/invoice';

class ExchangeRateService {
  private readonly API_BASE_URL = 'https://api.exchangerate-api.com/v4/latest';
  private readonly FALLBACK_API_URL = 'https://api.fxratesapi.com/latest';
  private readonly BACKUP_API_URL = 'https://api.fixer.io/latest';
  private readonly LIVE_API_URL = 'https://api.currencyapi.com/v3/latest'; // More accurate rates
  private readonly XE_COMPATIBLE_API = 'https://v6.exchangerate-api.com/v6/latest'; // XE.com compatible
  
  // Enhanced fallback rates (updated to current market values - Aug 2025)
  private readonly EMERGENCY_FALLBACK_RATES: { [key: string]: number } = {
    'USD': 83.15,     // 1 USD = 83.15 INR
    'GBP': 116.05,    // 1 GBP = 116.05 INR (updated from xe.com)
    'EUR': 101.147,   // 1 EUR = 101.147 INR (updated from xe.com - was 101.15)
    'AUD': 55.30,     // 1 AUD = 55.30 INR
    'CAD': 61.20,     // 1 CAD = 61.20 INR
    'SGD': 62.10,     // 1 SGD = 62.10 INR
    'AED': 22.60,     // 1 AED = 22.60 INR
    'SAR': 22.15,     // 1 SAR = 22.15 INR
    'JPY': 0.57,      // 1 JPY = 0.57 INR
    'CNY': 11.60,     // 1 CNY = 11.60 INR
    'CHF': 93.20,     // 1 CHF = 93.20 INR
    'NZD': 50.80,     // 1 NZD = 50.80 INR
  };

  /**
   * Check if user is authenticated before making API calls or database operations
   */
  private async checkAuthentication(): Promise<boolean> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        console.warn('Exchange rate service: User not authenticated');
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('Exchange rate service: Authentication check failed:', error);
      return false;
    }
  }

  /**
   * Get exchange rate directly from database for specific date
   * NEW STRUCTURE: target_currency is always 'INR'
   * REQUIRES AUTHENTICATION
   */
  private async getDatabaseRate(fromCurrency: string, toCurrency: string, date: string): Promise<number | null> {
    try {
      // Check authentication before database access
      const isAuthenticated = await this.checkAuthentication();
      if (!isAuthenticated) {
        console.warn('Exchange rate database access denied: User not authenticated');
        return null;
      }

      // Case 1: Same currency
      if (fromCurrency === toCurrency) {
        return 1.0;
      }
      
      // Case 2: Converting TO INR (foreign currency → INR)
      if (toCurrency === 'INR') {
        const { data, error } = await supabase
          .from('exchange_rates')
          .select('rate')
          .eq('base_currency', fromCurrency)
          .eq('target_currency', 'INR')
          .eq('date', date)
          .single();

        if (error || !data) {
          return null;
        }

        return parseFloat(data.rate);
      }
      
      // Case 3: Converting FROM INR (INR → foreign currency)
      if (fromCurrency === 'INR') {
        const { data, error } = await supabase
          .from('exchange_rates')
          .select('rate')
          .eq('base_currency', toCurrency)
          .eq('target_currency', 'INR')
          .eq('date', date)
          .single();

        if (error || !data) {
          return null;
        }

        // Inverse the rate since we have foreign→INR but need INR→foreign
        return 1 / parseFloat(data.rate);
      }
      
      // Case 4: Cross conversion (foreign currency A → foreign currency B)
      // This requires two lookups: A→INR and B→INR, then calculate A→B
      const [aToInrData, bToInrData] = await Promise.all([
        supabase
          .from('exchange_rates')
          .select('rate')
          .eq('base_currency', fromCurrency)
          .eq('target_currency', 'INR')
          .eq('date', date)
          .single(),
        supabase
          .from('exchange_rates')
          .select('rate')
          .eq('base_currency', toCurrency)
          .eq('target_currency', 'INR')
          .eq('date', date)
          .single()
      ]);
      
      if (aToInrData.error || !aToInrData.data || bToInrData.error || !bToInrData.data) {
        return null;
      }
      
      const aToInrRate = parseFloat(aToInrData.data.rate);
      const bToInrRate = parseFloat(bToInrData.data.rate);
      
      // Calculate cross rate: A→B = (A→INR) / (B→INR)
      return aToInrRate / bToInrRate;
      
    } catch (error) {
      console.error(`Error fetching database rate for ${fromCurrency}→${toCurrency} on ${date}:`, error);
      return null;
    }
  }

  /**
   * Get recent exchange rate from database (within specified days)
   * NEW STRUCTURE: target_currency is always 'INR'
   */
  private async getRecentDatabaseRate(fromCurrency: string, toCurrency: string, withinDays: number = 7): Promise<number | null> {
    try {
      // Case 1: Same currency
      if (fromCurrency === toCurrency) {
        return 1.0;
      }
      
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - withinDays);
      const thresholdDate = dateThreshold.toISOString().split('T')[0];
      
      // Case 2: Converting TO INR (foreign currency → INR)
      if (toCurrency === 'INR') {
        const { data, error } = await supabase
          .from('exchange_rates')
          .select('rate, date')
          .eq('base_currency', fromCurrency)
          .eq('target_currency', 'INR')
          .gte('date', thresholdDate)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          return null;
        }

        return parseFloat(data.rate);
      }
      
      // Case 3: Converting FROM INR (INR → foreign currency)
      if (fromCurrency === 'INR') {
        const { data, error } = await supabase
          .from('exchange_rates')
          .select('rate, date')
          .eq('base_currency', toCurrency)
          .eq('target_currency', 'INR')
          .gte('date', thresholdDate)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          return null;
        }

        // Inverse the rate since we have foreign→INR but need INR→foreign
        return 1 / parseFloat(data.rate);
      }
      
      // Case 4: Cross conversion - get most recent rates for both currencies
      const [aToInrData, bToInrData] = await Promise.all([
        supabase
          .from('exchange_rates')
          .select('rate, date')
          .eq('base_currency', fromCurrency)
          .eq('target_currency', 'INR')
          .gte('date', thresholdDate)
          .order('date', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('exchange_rates')
          .select('rate, date')
          .eq('base_currency', toCurrency)
          .eq('target_currency', 'INR')
          .gte('date', thresholdDate)
          .order('date', { ascending: false })
          .limit(1)
          .single()
      ]);
      
      if (aToInrData.error || !aToInrData.data || bToInrData.error || !bToInrData.data) {
        return null;
      }
      
      const aToInrRate = parseFloat(aToInrData.data.rate);
      const bToInrRate = parseFloat(bToInrData.data.rate);
      
      // Calculate cross rate: A→B = (A→INR) / (B→INR)
      return aToInrRate / bToInrRate;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Get emergency fallback rate when all else fails
   */
  private getEmergencyFallbackRate(fromCurrency: string, toCurrency: string): number | null {
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    // Direct rate available
    if (fromCurrency !== 'INR' && toCurrency === 'INR') {
      return this.EMERGENCY_FALLBACK_RATES[fromCurrency] || null;
    }

    // Inverse rate calculation
    if (fromCurrency === 'INR' && toCurrency !== 'INR') {
      const inverseRate = this.EMERGENCY_FALLBACK_RATES[toCurrency];
      return inverseRate ? (1 / inverseRate) : null;
    }

    // Cross rate calculation via INR
    if (fromCurrency !== 'INR' && toCurrency !== 'INR') {
      const fromToINR = this.EMERGENCY_FALLBACK_RATES[fromCurrency];
      const toToINR = this.EMERGENCY_FALLBACK_RATES[toCurrency];
      
      if (fromToINR && toToINR) {
        return fromToINR / toToINR;
      }
    }

    return null;
  }

  /**
   * Get exchange rate from database with smart fallback
   * This is the primary method that should be used for all conversions
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string, date?: string): Promise<number | null> {
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    // Check authentication before any operations
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      console.warn('Exchange rate access denied: User not authenticated');
      return null;
    }

    if (!isSupabaseConfigured) {
      console.warn('Database not configured, using emergency fallback rates');
      return this.getEmergencyFallbackRate(fromCurrency, toCurrency);
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    
    try {
      // Primary: Try direct conversion from database (handles all cases with new structure)
      console.log(`🔍 Checking database for ${fromCurrency} → ${toCurrency} on ${targetDate}`);
      
      const directRate = await this.getDatabaseRate(fromCurrency, toCurrency, targetDate);
      if (directRate) {
        console.log(`✅ Found rate in database: 1 ${fromCurrency} = ${directRate} ${toCurrency}`);
        return directRate;
      }

      // Secondary: Check for recent rates (within 7 days)
      console.log(`🔍 No rate found for ${targetDate}, checking recent rates...`);
      const recentRate = await this.getRecentDatabaseRate(fromCurrency, toCurrency, 7);
      if (recentRate) {
        console.log(`⏰ Found recent rate (within 7 days): 1 ${fromCurrency} = ${recentRate} ${toCurrency}`);
        return recentRate;
      }

      // Tertiary: Try to update rates and check again
      console.log(`🔄 No recent rates found, attempting to update exchange rates...`);
      const updateSuccess = await this.updateExchangeRates(false);
      
      if (updateSuccess) {
        const freshRate = await this.getDatabaseRate(fromCurrency, toCurrency, targetDate);
        if (freshRate) {
          console.log(`✅ Found fresh rate after update: 1 ${fromCurrency} = ${freshRate} ${toCurrency}`);
          return freshRate;
        }
      }

    } catch (error) {
      console.error('Database exchange rate lookup failed:', error);
    }

    // Emergency fallback
    console.warn(`⚠️ Using emergency fallback rate for ${fromCurrency} → ${toCurrency}`);
    return this.getEmergencyFallbackRate(fromCurrency, toCurrency);
  }
  
  /**
   * Fetch current exchange rates from external API with multiple fallbacks
   * @param baseCurrency - Base currency (default: INR)
   * @returns Exchange rates object
   */
  async fetchCurrentRates(baseCurrency: string = 'INR'): Promise<ExchangeRateApiResponse> {
    // Check authentication before making any API calls
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      console.warn('Exchange rate API access denied: User not authenticated');
      throw new Error('Authentication required for exchange rate API access');
    }

    // Enhanced API list with working free sources (no API key required)
    const apis = [
      { 
        url: `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`, 
        name: 'ExchangeRate-API (High Accuracy)',
        transform: (data: any) => data
      },
      { 
        url: `https://api.fxratesapi.com/latest?base=${baseCurrency}`, 
        name: 'FX Rates API (Free)',
        transform: (data: any) => data
      },
      { 
        url: `https://open.er-api.com/v6/latest/${baseCurrency}`, 
        name: 'Open Exchange Rates API',
        transform: (data: any) => data
      },
      { 
        url: `https://api.exchangerate.host/latest?base=${baseCurrency}`, 
        name: 'ExchangeRate.host (Free)',
        transform: (data: any) => data
      },
      // Keep the premium ones but they'll fail gracefully if no API key
      { 
        url: `https://api.currencyapi.com/v3/latest?apikey=FREE&base_currency=${baseCurrency}`, 
        name: 'CurrencyAPI (Premium - Requires Key)',
        transform: (data: any) => ({ base: baseCurrency, rates: data.data || {} })
      },
      { 
        url: `https://v6.exchangerate-api.com/v6/latest/${baseCurrency}`, 
        name: 'ExchangeRate-API v6 (Premium - Requires Key)',
        transform: (data: any) => data
      }
    ];

    console.log(`🌐 Fetching exchange rates with ${baseCurrency} as base currency from ${apis.length} sources...`);

    // Try to get more accurate rates first
    for (const api of apis) {
      try {
        console.log(`🌐 Fetching live rates from ${api.name}...`);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(api.url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'KDADKS-Invoice-System/1.0',
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }
        
        const rawData = await response.json();
        const data: ExchangeRateApiResponse = api.transform ? api.transform(rawData) : rawData;
        
        if (!data.rates) {
          throw new Error('Invalid response format from exchange rate API - no rates object');
        }

        // Validate that we have major currencies with reasonable rates
        const majorCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD'];
        const validRates = majorCurrencies.filter(currency => {
          const rate = data.rates[currency];
          return rate && typeof rate === 'number' && rate > 0;
        });

        if (validRates.length < 3) {
          throw new Error(`Insufficient major currency rates found. Only got: ${validRates.join(', ')}`);
        }

        // Log rates for debugging
        console.log(`✅ Successfully fetched live rates from ${api.name}`);
        console.log(`📊 Key rates: GBP=${data.rates.GBP}, EUR=${data.rates.EUR}, USD=${data.rates.USD}`);
        
        // Special logging for EUR rate comparison
        if (data.rates.EUR) {
          console.log(`💱 EUR rate fetched: ${data.rates.EUR} (xe.com shows ~101.147)`);
        }
        
        return data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`❌ ${api.name} failed: ${errorMessage}`);
        
        // Add specific handling for common errors
        if (errorMessage.includes('Failed to fetch')) {
          console.warn(`🌐 Network connectivity issue with ${api.name}:`);
          console.warn(`   - This may be due to CORS policy, network connectivity, or API server issues`);
          console.warn(`   - The app will try other APIs automatically`);
          console.warn(`   - If all APIs fail, cached/fallback rates will be used`);
        } else if (errorMessage.includes('AbortError')) {
          console.warn(`⏱️ ${api.name} request timed out after 10 seconds`);
        } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
          console.warn(`🔑 ${api.name} requires API key - skipping to free alternatives`);
        }
        
        continue;
      }
    }

    const errorMsg = 'All exchange rate APIs failed. Using fallback rates or cached data.';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  /**
   * Update exchange rates in database with smart batch processing
   * @param forceUpdate - Force update even if rates exist for today
   * @returns boolean indicating success
   */
  async updateExchangeRates(forceUpdate: boolean = false): Promise<boolean> {
    if (!isSupabaseConfigured) {
      console.warn('Database not configured, skipping exchange rate update');
      return false;
    }

    // Check authentication before any API calls or database operations
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      console.warn('Exchange rate update denied: User not authenticated');
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Check if we already have rates for today (unless forcing update)
      if (!forceUpdate) {
        const { count } = await supabase
          .from('exchange_rates')
          .select('*', { count: 'exact', head: true })
          .eq('date', today);
        
        if (count && count > 0) {
          console.log(`📅 Exchange rates for ${today} already exist. Skipping update.`);
          return true;
        }
      }

      console.log(`🔄 ${forceUpdate ? 'Force updating' : 'Updating'} exchange rates for ${today}...`);

      // Fetch rates with INR as base currency (what we need for invoicing)
      const ratesData = await this.fetchCurrentRates('INR');
      
      // Log some key rates for verification against xe.com
      console.log(`📊 Key rates fetched: GBP=${ratesData.rates.GBP}, EUR=${ratesData.rates.EUR}, USD=${ratesData.rates.USD}`);
      console.log(`🔍 XE.com comparison: EUR should be ~101.147, fetched=${ratesData.rates.EUR}`);
      console.log(`🔍 XE.com comparison: GBP should be ~116.047, fetched=${ratesData.rates.GBP}`);
      
      // Prepare batch insert data
      // NEW STRUCTURE: Only insert foreign_currency → INR rates
      // base_currency = foreign currency, target_currency = always 'INR'
      const ratesToInsert: any[] = [];
      
      // Convert API rates (which are INR → foreign currency) to our format (foreign currency → INR)
      for (const [currency, rate] of Object.entries(ratesData.rates)) {
        if (currency !== 'INR' && typeof rate === 'number' && rate !== 0) {
          // API gives us how many foreign units = 1 INR
          // We want how many INR = 1 foreign unit, so we take the inverse
          const inrRate = 1 / rate;
          ratesToInsert.push({
            base_currency: currency,        // Foreign currency (USD, EUR, etc.)
            target_currency: 'INR',        // Always INR
            rate: inrRate,                 // How many INR = 1 unit of foreign currency
            date: today,
            source: forceUpdate ? 'manual-update' : 'api-automated-update'
          });
        }
      }

      if (ratesToInsert.length === 0) {
        console.warn('No valid exchange rates to insert');
        return false;
      }

      // Log specific rates being inserted
      const gbpToInr = ratesToInsert.find(r => r.base_currency === 'GBP');
      const eurToInr = ratesToInsert.find(r => r.base_currency === 'EUR');
      const usdToInr = ratesToInsert.find(r => r.base_currency === 'USD');
      
      console.log(`💱 Inserting rates (Foreign→INR): GBP→INR=${gbpToInr?.rate?.toFixed(2)}, EUR→INR=${eurToInr?.rate?.toFixed(2)}, USD→INR=${usdToInr?.rate?.toFixed(2)}`);

      // Batch insert with upsert (handle conflicts with new constraint)
      const { error } = await supabase
        .from('exchange_rates')
        .upsert(ratesToInsert, {
          onConflict: 'base_currency,date',  // Updated conflict resolution
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Failed to update exchange rates:', error);
        return false;
      }

      console.log(`✅ Successfully updated ${ratesToInsert.length} exchange rates for ${today}`);
      
      if (forceUpdate) {
        console.log(`🚀 Manual update completed! Latest GBP rate: ${gbpToInr?.rate || 'N/A'}`);
      }
      
      return true;

    } catch (error) {
      console.error('Failed to update exchange rates:', error);
      return false;
    }
  }

  /**
   * Schedule daily exchange rate updates
   * This should be called on application startup
   */
  async scheduleDailyUpdates(): Promise<void> {
    // Check authentication before setting up scheduled updates
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      console.warn('Daily update scheduling denied: User not authenticated');
      return;
    }

    console.log('📅 Setting up daily exchange rate update schedule...');
    
    // Calculate milliseconds until next 00:01 UTC
    const now = new Date();
    const nextUpdate = new Date();
    nextUpdate.setUTCHours(0, 1, 0, 0); // 00:01 UTC
    
    // If we've passed today's update time, schedule for tomorrow
    if (now >= nextUpdate) {
      nextUpdate.setUTCDate(nextUpdate.getUTCDate() + 1);
    }
    
    const msUntilUpdate = nextUpdate.getTime() - now.getTime();
    
    console.log(`⏰ Next exchange rate update scheduled for: ${nextUpdate.toISOString()}`);
    console.log(`⏱️ Time until next update: ${Math.round(msUntilUpdate / 1000 / 60)} minutes`);
    
    // Set initial timeout
    setTimeout(() => {
      this.performDailyUpdate();
      
      // Set up daily interval (24 hours)
      setInterval(() => {
        this.performDailyUpdate();
      }, 24 * 60 * 60 * 1000);
      
    }, msUntilUpdate);
  }

  /**
   * Perform daily update with error handling and retry logic
   */
  private async performDailyUpdate(): Promise<void> {
    console.log('🌅 Performing daily exchange rate update...');
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const success = await this.updateExchangeRates(true);
        if (success) {
          console.log('✅ Daily exchange rate update completed successfully');
          return;
        }
      } catch (error) {
        console.error(`❌ Daily update attempt ${retryCount + 1} failed:`, error);
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        // Wait 5 minutes before retry
        console.log(`⏳ Retrying in 5 minutes... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      }
    }
    
    console.error('❌ All daily update attempts failed. Manual intervention may be required.');
  }

  /**
   * Convert currency using database rates with validation
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date?: string
  ): Promise<CurrencyConversion | null> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency, date);
    
    if (!rate) {
      return null;
    }

    // Validate rate for major currencies to prevent backward conversion
    if (toCurrency === 'INR' && ['EUR', 'USD', 'GBP'].includes(fromCurrency)) {
      if (rate < 50) {
        console.warn(`🚨 Suspicious rate detected: 1 ${fromCurrency} = ${rate} INR (too low)`);
        return null;
      }
    }

    const convertedAmount = Math.round((amount * rate) * 100) / 100;

    return {
      original_amount: amount,
      from_currency: fromCurrency,
      converted_amount: convertedAmount,
      to_currency: toCurrency,
      exchange_rate: rate,
      conversion_date: date || new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Convert any currency to INR (most common use case)
   */
  async convertToINR(amount: number, fromCurrency: string, date?: string): Promise<number> {
    // Bypass conversion for zero or negative amounts
    if (amount <= 0) {
      return 0;
    }
    
    if (fromCurrency === 'INR') {
      return amount;
    }
    
    const conversion = await this.convertCurrency(amount, fromCurrency, 'INR', date);
    
    if (conversion && conversion.converted_amount > 0) {
      // Additional validation for major currencies
      if (['EUR', 'USD', 'GBP'].includes(fromCurrency)) {
        const conversionRatio = conversion.converted_amount / amount;
        if (conversionRatio < 10) {
          console.warn(`🚨 Backward conversion detected: ${amount} ${fromCurrency} → ${conversion.converted_amount} INR (ratio: ${conversionRatio})`);
          
          // Use emergency fallback
          const fallbackRate = this.getEmergencyFallbackRate(fromCurrency, 'INR');
          if (fallbackRate) {
            const fallbackAmount = Math.round((amount * fallbackRate) * 100) / 100;
            console.log(`💡 Using emergency fallback: ${amount} ${fromCurrency} → ${fallbackAmount} INR (rate: ${fallbackRate})`);
            return fallbackAmount;
          }
        }
      }
      return conversion.converted_amount;
    }
    
    // Last resort: emergency fallback
    console.warn(`Could not convert ${amount} ${fromCurrency} to INR, using emergency fallback`);
    const fallbackRate = this.getEmergencyFallbackRate(fromCurrency, 'INR');
    
    if (fallbackRate) {
      const fallbackAmount = Math.round((amount * fallbackRate) * 100) / 100;
      console.log(`💡 Emergency fallback: ${amount} ${fromCurrency} → ${fallbackAmount} INR (rate: ${fallbackRate})`);
      return fallbackAmount;
    }
    
    return amount; // Return original amount as last resort
  }

  /**
   * Get available currencies from database
   */
  async getAvailableCurrencies(): Promise<{currency: string; rate: number; date: string}[]> {
    if (!isSupabaseConfigured) {
      return [];
    }
    
    try {
      const { data } = await supabase
        .from('exchange_rates')
        .select('target_currency, rate, date')
        .eq('base_currency', 'INR')
        .order('date', { ascending: false });
      
      if (!data) return [];
      
      // Get latest rate for each currency
      const latestRates = new Map<string, {rate: number; date: string}>();
      
      for (const record of data) {
        if (!latestRates.has(record.target_currency)) {
          latestRates.set(record.target_currency, {
            rate: record.rate,
            date: record.date
          });
        }
      }
      
      return Array.from(latestRates.entries()).map(([currency, info]) => ({
        currency,
        rate: info.rate,
        date: info.date
      }));
    } catch (error) {
      console.error('Error getting available currencies:', error);
      return [];
    }
  }

  /**
   * Get database health and coverage information
   */
  async getDatabaseHealth(): Promise<{
    total_rates: number;
    latest_update: string;
    currencies_covered: string[];
    missing_today: string[];
  }> {
    if (!isSupabaseConfigured) {
      return {
        total_rates: 0,
        latest_update: 'N/A',
        currencies_covered: [],
        missing_today: []
      };
    }

    // Check authentication before database access
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      console.warn('Database health check denied: User not authenticated');
      return {
        total_rates: 0,
        latest_update: 'Authentication Required',
        currencies_covered: [],
        missing_today: []
      };
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get total rates
      const { count: totalRates } = await supabase
        .from('exchange_rates')
        .select('*', { count: 'exact', head: true });

      // Get latest update
      const { data: latestData } = await supabase
        .from('exchange_rates')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      // Get currencies covered today (NEW STRUCTURE: base_currency = foreign, target_currency = INR)
      const { data: todayRates } = await supabase
        .from('exchange_rates')
        .select('base_currency')
        .eq('date', today)
        .eq('target_currency', 'INR');

      const currenciesToday = todayRates?.map(r => r.base_currency) || [];
      const expectedCurrencies = Object.keys(this.EMERGENCY_FALLBACK_RATES);
      const missingToday = expectedCurrencies.filter(curr => !currenciesToday.includes(curr));

      return {
        total_rates: totalRates || 0,
        latest_update: latestData?.date || 'N/A',
        currencies_covered: currenciesToday,
        missing_today: missingToday
      };
    } catch (error) {
      console.error('Error getting database health:', error);
      return {
        total_rates: 0,
        latest_update: 'Error',
        currencies_covered: [],
        missing_today: []
      };
    }
  }

  /**
   * Initialize service (called on app startup)
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Exchange Rate Service...');
    
    // Check authentication before initialization
    const isAuthenticated = await this.checkAuthentication();
    if (!isAuthenticated) {
      console.warn('Exchange rate service initialization denied: User not authenticated');
      return;
    }
    
    try {
      // Check database health first
      const health = await this.getDatabaseHealth();
      console.log('📊 Database Health:', health);
      
      // Only update rates if we have NO rates for today AND we're missing critical currencies
      const criticalCurrencies = ['USD', 'EUR', 'GBP'];
      const missingCritical = health.missing_today.filter(curr => criticalCurrencies.includes(curr));
      
      if (missingCritical.length > 0) {
        console.log(`🔄 Missing critical currencies (${missingCritical.join(', ')}) for today, updating...`);
        // Add a small delay to avoid immediate API bombardment
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.updateExchangeRates(false);
      } else if (health.missing_today.length > 0) {
        console.log(`ℹ️ Missing some currencies for today (${health.missing_today.join(', ')}), but critical ones available. Will update on-demand.`);
      }
      
      // Schedule daily updates
      await this.scheduleDailyUpdates();
      
      console.log('✅ Exchange Rate Service initialized successfully');
    } catch (error) {
      console.warn('⚠️ Exchange Rate Service initialization had issues:', error);
      // Continue gracefully - the app should work even without live exchange rates
    }
  }
}

export const exchangeRateService = new ExchangeRateService();
