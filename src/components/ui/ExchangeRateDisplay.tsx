import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import { exchangeRateService } from '../../services/exchangeRateService';
import { useToast } from '../ui/ToastProvider';
import type { Customer } from '../../types/invoice';

interface ExchangeRateDisplayProps {
  selectedCustomer: Customer | undefined;
  onRateUpdate?: (newRate: number) => void;
  showUpdateButton?: boolean;  // New prop to control update functionality
}

export const ExchangeRateDisplay: React.FC<ExchangeRateDisplayProps> = ({
  selectedCustomer,
  onRateUpdate,
  showUpdateButton = true  // Default to true for backward compatibility
}) => {
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [_lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  // Check if customer has non-INR currency
  const customerCurrency = selectedCustomer?.country?.currency_code;
  const isNonINRCustomer = customerCurrency && customerCurrency !== 'INR';

  // Fetch current exchange rate from database
  const fetchCurrentRate = async () => {
    if (!isNonINRCustomer || !customerCurrency) return;

    setLoading(true);
    setError(null);
    
    try {
      const rate = await exchangeRateService.getExchangeRate(customerCurrency, 'INR');
      if (rate) {
        setCurrentRate(rate);
        setLastUpdated(new Date());
      } else {
        setError('No exchange rate found in database');
      }
    } catch (err) {
      console.error('Failed to fetch exchange rate:', err);
      setError('Failed to fetch exchange rate');
    } finally {
      setLoading(false);
    }
  };

  // Update exchange rate from internet
  const updateExchangeRate = async () => {
    if (!isNonINRCustomer || !customerCurrency) return;

    setUpdating(true);
    setError(null);

    try {
      console.log(`🔄 Updating exchange rate for ${customerCurrency} → INR`);
      
      // Force update exchange rates from internet
      const success = await exchangeRateService.updateExchangeRates(true);
      
      if (success) {
        // Fetch the updated rate
        const newRate = await exchangeRateService.getExchangeRate(customerCurrency, 'INR');
        if (newRate) {
          setCurrentRate(newRate);
          setLastUpdated(new Date());
          onRateUpdate?.(newRate);
          showSuccess(`Exchange rate updated successfully! 1 ${customerCurrency} = ₹${newRate.toFixed(4)}`);
        } else {
          throw new Error('Failed to fetch updated rate');
        }
      } else {
        throw new Error('Failed to update exchange rates');
      }
    } catch (err) {
      console.error('Failed to update exchange rate:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update exchange rate';
      setError(errorMessage);
      showError(`Failed to update exchange rate: ${errorMessage}`);
    } finally {
      setUpdating(false);
    }
  };

  // Fetch rate when customer changes
  useEffect(() => {
    if (isNonINRCustomer) {
      fetchCurrentRate();
    } else {
      setCurrentRate(null);
      setError(null);
      setLastUpdated(null);
    }
  }, [selectedCustomer?.id, customerCurrency]);

  // Don't show component for INR customers or when no customer is selected
  if (!isNonINRCustomer) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mt-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <TrendingUp className="w-5 h-5 text-amber-600 mr-2" />
          <div>
            <h4 className="text-sm font-semibold text-amber-900">Exchange Rate</h4>
            <p className="text-xs text-amber-700 mt-1">
              {showUpdateButton 
                ? 'Current rate from database • Customer currency: ' 
                : 'Saved rate for this invoice • Customer currency: '
              }{customerCurrency}
            </p>
          </div>
        </div>
        
        {showUpdateButton && (
          <button
            onClick={updateExchangeRate}
            disabled={updating || loading}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${updating ? 'animate-spin' : ''}`} />
            {updating ? 'Updating...' : 'Update Rates'}
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-600 border-t-transparent mr-2"></div>
            <span className="text-sm text-amber-700">Loading exchange rate...</span>
          </div>
        ) : error ? (
          <div className="flex items-center text-red-600">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        ) : currentRate ? (
          <div className="bg-white rounded-lg p-3 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-slate-900">
                  1 {customerCurrency} = ₹{currentRate.toFixed(4)}
                </span>
              </div>
              {showUpdateButton && (
                <div className="text-right">
                  <div className="text-xs text-slate-500">
                    For reference, check current rates at
                  </div>
                  <a 
                    href={`https://xe.com/currencyconverter/convert/?Amount=1&From=${customerCurrency}&To=INR`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    xe.com
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-amber-700">
            No exchange rate available for {customerCurrency}
          </div>
        )}
      </div>

      {showUpdateButton && (
        <div className="mt-3 pt-3 border-t border-amber-200">
          <p className="text-xs text-amber-700">
            💡 <strong>Tip:</strong> If the rate seems incorrect compared to xe.com, click "Update Rates" to fetch the latest rates from the internet.
          </p>
        </div>
      )}
    </div>
  );
};
