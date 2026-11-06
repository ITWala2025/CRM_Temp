import type { Lead } from '../types/lead';
import type { CompanySettings } from '../types/invoice';

export const getLeadEntityPrefix = (company: CompanySettings | null | undefined): string => {
  if (!company) return 'LEAD';
  const code = (company.country?.code ?? '').toUpperCase();
  if (code === 'IN' || code === 'IND') return 'IND-LEAD';
  if (code === 'IE' || code === 'IRL') return 'IRL-LEAD';
  if (code && /^[A-Z]{2,4}$/.test(code)) return `${code}-LEAD`;
  return 'LEAD';
};

export const getOpportunityEntityPrefix = (company: CompanySettings | null | undefined): string => {
  if (!company) return 'OPP';
  const code = (company.country?.code ?? '').toUpperCase();
  if (code === 'IN' || code === 'IND') return 'IND-OPP';
  if (code === 'IE' || code === 'IRL') return 'IRL-OPP';
  if (code && /^[A-Z]{2,4}$/.test(code)) return `${code}-OPP`;
  return 'OPP';
};

export const getLeadDefaultTaxRate = (company: CompanySettings | null | undefined): number => {
  const code = company?.country?.code?.toUpperCase();
  if (code === 'IN' || code === 'IND') return 18;
  if (code === 'IE' || code === 'IRL') return 23;
  return 20;
};

export const getLeadTaxLabel = (company: CompanySettings | null | undefined): string => {
  const code = company?.country?.code?.toUpperCase();
  if (code === 'IN' || code === 'IND') return 'IGST';
  if (code === 'IE' || code === 'IRL') return 'VAT';
  return 'VAT';
};

export const validateLeadEntityFields = (lead: Partial<Lead>, countryCode?: string): string[] => {
  const errors: string[] = [];
  const code = (countryCode ?? '').toUpperCase();

  if (code === 'IN' || code === 'IND') {
    if (lead.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(lead.gstin)) {
      errors.push('Invalid GSTIN format for India entity');
    }
    if (lead.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(lead.pan)) {
      errors.push('Invalid PAN format for India entity');
    }
  }

  if (code === 'IE' || code === 'IRL') {
    if (lead.vat_number && lead.vat_number.trim().length < 7) {
      errors.push('VAT Number is required for Ireland entity');
    }
  }

  return errors;
};
