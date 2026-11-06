import React, { useState, useEffect } from 'react';
import { exchangeRateService } from '../../services/exchangeRateService';

// Utility function to get currency symbol
const getCurrencySymbol = (code: string) => {
  switch (code) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'INR': return '₹';
    case 'AUD': return 'A$';
    case 'CAD': return 'C$';
    case 'SGD': return 'S$';
    case 'AED': return 'AED ';
    case 'SAR': return 'SAR ';
    case 'JPY': return '¥';
    case 'CNY': return '¥';
    default: return code + ' ';
  }
};

interface CurrencyDisplayProps {
  amount: number;
  currencyCode: string;
  inrAmount?: number;
  targetCurrency?: string; // Target base currency, defaults to 'INR'
  targetAmount?: number;   // Pre-calculated target currency amount (optional)
  showBothCurrencies?: boolean;
  className?: string;
  conversionDate?: string; // Add date for historical conversion
}

/**
 * Component to display currency amounts with optional target currency conversion
 */
export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  currencyCode,
  inrAmount,
  targetCurrency = 'INR',
  targetAmount,
  showBothCurrencies = false,
  className = '',
  conversionDate
}) => {
  const effectiveTargetCurrency = targetCurrency || 'INR';
  const initialTargetAmount = targetAmount !== undefined && targetAmount !== null
    ? targetAmount
    : (effectiveTargetCurrency === 'INR' ? (inrAmount ?? null) : null);

  const [calculatedTargetAmount, setCalculatedTargetAmount] = useState<number | null>(initialTargetAmount);
  const [isCalculating, setIsCalculating] = useState(false);

  // Effect to calculate target currency amount if missing and needed
  useEffect(() => {
    if (targetAmount !== undefined && targetAmount !== null) {
      setCalculatedTargetAmount(targetAmount);
      return;
    }
    if (effectiveTargetCurrency === 'INR' && inrAmount !== undefined && inrAmount !== null) {
      setCalculatedTargetAmount(inrAmount);
      return;
    }

    if (showBothCurrencies && currencyCode !== effectiveTargetCurrency && calculatedTargetAmount === null && !isCalculating) {
      setIsCalculating(true);
      
      const convertWithTimeout = async () => {
        try {
          const converted = await Promise.race([
            exchangeRateService.convertCurrency(amount, currencyCode, effectiveTargetCurrency, conversionDate),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            )
          ]);
          if (converted && typeof converted.converted_amount === 'number') {
            setCalculatedTargetAmount(converted.converted_amount);
          } else {
            throw new Error('Invalid conversion output');
          }
        } catch (error) {
          console.warn(`Failed to convert currency ${currencyCode} -> ${effectiveTargetCurrency} in CurrencyDisplay:`, error);
          let rateFromInr = 1.0;
          switch (currencyCode) {
            case 'USD': rateFromInr = 83.15; break;
            case 'GBP': rateFromInr = 116.05; break;
            case 'EUR': rateFromInr = 101.15; break;
            case 'AUD': rateFromInr = 55.30; break;
            case 'CAD': rateFromInr = 61.20; break;
            case 'SGD': rateFromInr = 62.10; break;
            case 'AED': rateFromInr = 22.60; break;
            case 'SAR': rateFromInr = 22.15; break;
            case 'JPY': rateFromInr = 0.57; break;
            case 'CNY': rateFromInr = 11.60; break;
            default: rateFromInr = 1.0;
          }
          let rateTargetInr = 1.0;
          switch (effectiveTargetCurrency) {
            case 'USD': rateTargetInr = 83.15; break;
            case 'GBP': rateTargetInr = 116.05; break;
            case 'EUR': rateTargetInr = 101.15; break;
            case 'AUD': rateTargetInr = 55.30; break;
            case 'CAD': rateTargetInr = 61.20; break;
            case 'SGD': rateTargetInr = 62.10; break;
            case 'AED': rateTargetInr = 22.60; break;
            case 'SAR': rateTargetInr = 22.15; break;
            case 'JPY': rateTargetInr = 0.57; break;
            case 'CNY': rateTargetInr = 11.60; break;
            default: rateTargetInr = 1.0;
          }
          const crossRate = rateFromInr / rateTargetInr;
          setCalculatedTargetAmount(amount * crossRate);
        } finally {
          setIsCalculating(false);
        }
      };

      convertWithTimeout();
    }
  }, [amount, currencyCode, inrAmount, targetAmount, effectiveTargetCurrency, showBothCurrencies, calculatedTargetAmount, isCalculating, conversionDate]);

  const formatCurrency = (value: number, currency: string) => {
    const symbol = getCurrencySymbol(currency);
    const locale = currency === 'EUR' ? 'en-IE' : currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'en-IN';
    const formattedAmount = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    
    return `${symbol}${formattedAmount}`;
  };

  const effectiveAmount = calculatedTargetAmount;

  if (!showBothCurrencies || currencyCode === effectiveTargetCurrency || (effectiveAmount === null && !isCalculating)) {
    return (
      <span className={className}>
        {formatCurrency(amount, currencyCode)}
      </span>
    );
  }

  return (
    <span className={className}>
      <span className="font-medium">{formatCurrency(amount, currencyCode)}</span>
      <span className="text-sm text-gray-500 ml-1">
        {isCalculating ? '(calculating...)' : `(~${formatCurrency(effectiveAmount!, effectiveTargetCurrency)})`}
      </span>
    </span>
  );
};

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  currencyCode: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Input component for currency amounts
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  currencyCode,
  disabled = false,
  placeholder = '0.00',
  className = ''
}) => {
  const symbol = getCurrencySymbol(currencyCode);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value) || 0;
    onChange(numValue);
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span className="text-gray-500 sm:text-sm">{symbol}</span>
      </div>
      <input
        type="number"
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        step="0.01"
        min="0"
        className={`pl-10 ${className}`}
      />
    </div>
  );
};

export default CurrencyDisplay;
