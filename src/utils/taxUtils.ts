/**
 * Tax utility functions for handling different tax systems based on country
 */

import type { Customer, Country } from '../types/invoice';

/**
 * Get the appropriate tax label based on customer's country
 * @param customer - The customer object with country information
 * @returns The tax label to display (IGST for India, VAT for others)
 */
export const getTaxLabel = (customer: Customer | undefined): string => {
  // If no customer or no country information, default to IGST
  if (!customer || !customer.country) {
    return 'IGST';
  }

  // Check if customer is from India (using country code)
  const countryCode = customer.country.code?.toUpperCase();
  
  if (countryCode === 'IND' || countryCode === 'IN') {
    return 'IGST';
  }
  
  // For all other countries, use VAT
  return 'VAT';
};

/**
 * Get the appropriate tax field name for GSTIN/VAT registration
 * @param customer - The customer object with country information
 * @returns The tax registration field name
 */
export const getTaxRegistrationLabel = (customer: Customer | undefined): string => {
  const countryCode = customer?.country?.code?.toUpperCase();
  return getTaxRegistrationLabelByCode(countryCode);
};

export const getTaxRegistrationLabelByCode = (countryCode?: string): string => {
  const code = countryCode?.toUpperCase();
  
  switch (code) {
    case 'IND':
    case 'IN':
      return 'GSTIN';
    
    case 'USA':
    case 'US':
      return 'Federal Tax ID (EIN)';
    
    case 'CAN':
    case 'CA':
      return 'IGST/HST Number';
    
    case 'AUS':
    case 'AU':
      return 'ABN';
    
    case 'SGP':
    case 'SG':
      return 'UEN';
    
    case 'ARE':
    case 'AE':
      return 'TRN';
    
    case 'GBR':
    case 'GB':
    case 'UK':
      return 'VAT Number';
    
    case 'DEU':
    case 'DE':
      return 'Umsatzsteuer-ID';
    
    case 'FRA':
    case 'FR':
      return 'Numéro de TVA';
    
    case 'ESP':
    case 'ES':
      return 'Número de IVA';
    
    case 'ITA':
    case 'IT':
      return 'Partita IVA';
    
    case 'NLD':
    case 'NL':
      return 'BTW-nummer';
    
    case 'IRL':
    case 'IE':
      return 'VAT Number';
    
    default: {
      const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HU', 'IE', 'LV', 'LT', 'LU', 'MT', 'PL', 'PT', 'RO', 'SK', 'SI', 'SE'];
      if (code && euCountries.includes(code)) {
        return 'EU VAT Number';
      }
      return 'Tax Registration Number';
    }
  }
};

/**
 * Get the appropriate HSN/Classification code label
 * @param customer - The customer object with country information
 * @returns The classification code label
 */
export const getClassificationCodeLabel = (customer: Customer | undefined): string => {
  const taxLabel = getTaxLabel(customer);
  
  if (taxLabel === 'IGST') {
    return 'HSN Code';
  }
  
  return 'Product Code';
};

/**
 * Validate tax registration number based on country
 * @param taxNumber - The tax registration number to validate
 * @param customer - The customer object with country information
 * @returns Object with validation result and error message
 */
export const validateTaxRegistration = (
  taxNumber: string, 
  customer: Customer | undefined
): { isValid: boolean; error?: string } => {
  if (!taxNumber || !taxNumber.trim()) {
    return { isValid: true }; // Empty is valid (optional field)
  }

  const cleanTaxNumber = taxNumber.replace(/[\s\-.]/g, '').toUpperCase();
  const countryCode = customer?.country?.code?.toUpperCase();
  
  // Country-specific validation patterns
  switch (countryCode) {
    case 'IND':
    case 'IN': {
      // Indian GSTIN validation: 22AAAAA0000A1Z5
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid GSTIN (15 characters: 22AAAAA0000A1Z5)'
        };
      }
      break;
    }

    case 'USA':
    case 'US': {
      // US Federal Tax ID/EIN: XX-XXXXXXX or XXXXXXXXX
      const einRegex = /^[0-9]{2}-?[0-9]{7}$/;
      if (!einRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid EIN (9 digits: XX-XXXXXXX)'
        };
      }
      break;
    }

    case 'GBR':
    case 'GB':
    case 'UK': {
      // UK VAT: GB999999973 or 999999973
      const ukVatRegex = /^(GB)?[0-9]{9}$/;
      if (!ukVatRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid UK VAT number (9 digits: GB999999973)'
        };
      }
      break;
    }

    case 'CAN':
    case 'CA': {
      // Canada IGST/HST: 123456789RT0001
      const canadaGstRegex = /^[0-9]{9}RT[0-9]{4}$/;
      if (!canadaGstRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid Canadian IGST/HST number (123456789RT0001)'
        };
      }
      break;
    }

    case 'AUS':
    case 'AU': {
      // Australia ABN: 11 digits
      const abnRegex = /^[0-9]{11}$/;
      if (!abnRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid ABN (11 digits)'
        };
      }
      break;
    }

    case 'SGP':
    case 'SG': {
      // Singapore UEN: Various formats, basic validation
      const uenRegex = /^[0-9]{8,10}[A-Z]?$/;
      if (!uenRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid UEN (8-10 characters)'
        };
      }
      break;
    }

    case 'ARE':
    case 'AE': {
      // UAE TRN: 15 digits
      const trnRegex = /^[0-9]{15}$/;
      if (!trnRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid TRN (15 digits)'
        };
      }
      break;
    }

    case 'DEU':
    case 'DE': {
      // Germany VAT: DE999999999
      const deVatRegex = /^(DE)?[0-9]{9}$/;
      if (!deVatRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid German VAT number (DE999999999)'
        };
      }
      break;
    }

    case 'FRA':
    case 'FR': {
      // France VAT: FR99999999999
      const frVatRegex = /^(FR)?[A-Z0-9]{2}[0-9]{9}$/;
      if (!frVatRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid French VAT number (FR99999999999)'
        };
      }
      break;
    }

    case 'ESP':
    case 'ES': {
      // Spain VAT: ES999999999
      const esVatRegex = /^(ES)?[A-Z][0-9]{7}[A-Z]$/;
      if (!esVatRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid Spanish VAT number (ESA99999999)'
        };
      }
      break;
    }

    case 'ITA':
    case 'IT': {
      // Italy VAT: IT99999999999
      const itVatRegex = /^(IT)?[0-9]{11}$/;
      if (!itVatRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid Italian VAT number (IT99999999999)'
        };
      }
      break;
    }

    case 'NLD':
    case 'NL': {
      // Netherlands VAT: NL999999999B99
      const nlVatRegex = /^(NL)?[0-9]{9}B[0-9]{2}$/;
      if (!nlVatRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Please enter a valid Dutch VAT number (NL999999999B99)'
        };
      }
      break;
    }

    default: {
      // Generic validation for other countries
      if (cleanTaxNumber.length < 4 || cleanTaxNumber.length > 20) {
        return {
          isValid: false,
          error: 'Please enter a valid tax number (4-20 characters)'
        };
      }
      // Check for basic alphanumeric pattern
      const genericRegex = /^[A-Z0-9]+$/;
      if (!genericRegex.test(cleanTaxNumber)) {
        return {
          isValid: false,
          error: 'Tax number should contain only letters and numbers'
        };
      }
      break;
    }
  }
  
  return { isValid: true };
};

/**
 * Check if country uses IGST system
 * @param country - The country object
 * @returns True if country uses IGST, false otherwise
 */
export const isGSTCountry = (country: Country | undefined): boolean => {
  if (!country) return true; // Default to IGST if no country
  
  const countryCode = country.code?.toUpperCase();
  return countryCode === 'IND' || countryCode === 'IN';
};

/**
 * Get default tax rate based on country
 * @param customer - The customer object with country information
 * @returns Default tax rate for the country
 */
export const getDefaultTaxRate = (customer: Customer | undefined): number => {
  const countryCode = customer?.country?.code?.toUpperCase();
  
  // Country-specific default tax rates
  switch (countryCode) {
    case 'IND':
    case 'IN':
      return 18; // India IGST standard rate
    
    case 'USA':
    case 'US':
      return 0; // US sales tax varies by state, default to 0
    
    case 'CAN':
    case 'CA':
      return 13; // Canada average IGST/HST
    
    case 'AUS':
    case 'AU':
      return 10; // Australia IGST
    
    case 'SGP':
    case 'SG':
      return 7; // Singapore IGST
    
    case 'ARE':
    case 'AE':
      return 5; // UAE VAT
    
    case 'GBR':
    case 'GB':
    case 'UK':
      return 20; // UK VAT
    
    case 'DEU':
    case 'DE':
      return 19; // Germany VAT
    
    case 'FRA':
    case 'FR':
      return 20; // France VAT
    
    case 'ESP':
    case 'ES':
      return 21; // Spain VAT
    
    case 'ITA':
    case 'IT':
      return 22; // Italy VAT
    
    case 'NLD':
    case 'NL':
      return 21; // Netherlands VAT
    
    case 'CHE':
    case 'CH':
      return 7.7; // Switzerland VAT
    
    case 'NOR':
    case 'NO':
      return 25; // Norway VAT
    
    case 'SWE':
    case 'SE':
      return 25; // Sweden VAT
    
    case 'DNK':
    case 'DK':
      return 25; // Denmark VAT
    
    case 'FIN':
    case 'FI':
      return 24; // Finland VAT
    
    case 'JPN':
    case 'JP':
      return 10; // Japan consumption tax
    
    case 'KOR':
    case 'KR':
      return 10; // South Korea VAT
    
    case 'CHN':
    case 'CN':
      return 13; // China VAT
    
    case 'MEX':
    case 'MX':
      return 16; // Mexico IVA
    
    case 'BRA':
    case 'BR':
      return 17; // Brazil average VAT
    
    case 'RUS':
    case 'RU':
      return 20; // Russia VAT
    
    case 'ZAF':
    case 'ZA':
      return 15; // South Africa VAT
    
    default:
      // Default VAT rate for unspecified countries
      return 20;
  }
};

export interface TaxField {
  key: string;
  label: string;
  placeholder: string;
}

export interface BankingField {
  key: string;
  label: string;
  placeholder: string;
}

export const getCompanyTaxFields = (countryId?: string): { fields: TaxField[] } => {
  const code = countryId?.toUpperCase();
  if (code === 'IN' || code === 'IND') {
    return {
      fields: [
        { key: 'gstin', label: 'GSTIN', placeholder: 'Enter GSTIN' },
        { key: 'pan', label: 'PAN', placeholder: 'Enter PAN' },
        { key: 'cin', label: 'CIN', placeholder: 'Enter CIN' },
      ]
    };
  }
  if (code === 'IE' || code === 'IRL') {
    return {
      fields: [
        { key: 'vat_number', label: 'VAT Number', placeholder: 'Enter VAT Number' },
        { key: 'cro_number', label: 'CRO Number', placeholder: 'Enter CRO Number' },
        { key: 'pan', label: 'Tax ID', placeholder: 'Enter Tax ID' },
      ]
    };
  }
  if (code === 'GB' || code === 'GBR' || code === 'UK') {
    return {
      fields: [
        { key: 'gstin', label: 'VAT Number', placeholder: 'Enter VAT Number' },
        { key: 'pan', label: 'Tax ID', placeholder: 'Enter Tax ID' },
      ]
    };
  }
  if (code === 'US' || code === 'USA') {
    return {
      fields: [
        { key: 'gstin', label: 'Federal Tax ID (EIN)', placeholder: 'Enter EIN' },
        { key: 'pan', label: 'Tax ID', placeholder: 'Enter Tax ID' },
      ]
    };
  }
  return {
    fields: [
      { key: 'gstin', label: getTaxRegistrationLabelByCode(code) || 'Tax Registration Number', placeholder: `Enter ${getTaxRegistrationLabelByCode(code) || 'Tax Registration Number'}` },
    ]
  };
};

export const getCompanyBankingFields = (countryId?: string): { fields: BankingField[] } => {
  const code = countryId?.toUpperCase();
  if (code === 'IN' || code === 'IND') {
    return {
      fields: [
        { key: 'bank_name', label: 'Bank Name', placeholder: 'Enter bank name' },
        { key: 'branch_name', label: 'Branch Name', placeholder: 'Enter branch name' },
        { key: 'account_number', label: 'Account Number', placeholder: 'Enter account number' },
        { key: 'ifsc_code', label: 'IFSC Code', placeholder: 'Enter IFSC code' },
      ]
    };
  }
  if (code === 'IE' || code === 'IRL' || code === 'GB' || code === 'GBR' || code === 'UK') {
    return {
      fields: [
        { key: 'bank_name', label: 'Bank Name', placeholder: 'Enter bank name' },
        { key: 'branch_name', label: 'Branch Name', placeholder: 'Enter branch name' },
        { key: 'account_number', label: 'Account Number', placeholder: 'Enter account number' },
        { key: 'iban', label: 'IBAN', placeholder: 'Enter IBAN' },
        { key: 'swift_bic', label: 'SWIFT/BIC', placeholder: 'Enter SWIFT/BIC' },
      ]
    };
  }
  if (code === 'US' || code === 'USA') {
    return {
      fields: [
        { key: 'bank_name', label: 'Bank Name', placeholder: 'Enter bank name' },
        { key: 'branch_name', label: 'Branch Name', placeholder: 'Enter branch name' },
        { key: 'account_number', label: 'Account Number', placeholder: 'Enter account number' },
        { key: 'swift_bic', label: 'SWIFT/BIC', placeholder: 'Enter SWIFT/BIC' },
        { key: 'ifsc_code', label: 'Routing Number', placeholder: 'Enter routing number' },
      ]
    };
  }
  return {
    fields: [
      { key: 'bank_name', label: 'Bank Name', placeholder: 'Enter bank name' },
      { key: 'branch_name', label: 'Branch Name', placeholder: 'Enter branch name' },
      { key: 'account_number', label: 'Account Number', placeholder: 'Enter account number' },
      { key: 'swift_bic', label: 'SWIFT/BIC', placeholder: 'Enter SWIFT/BIC' },
    ]
  };
};
