import type { Customer, CompanySettings } from '../types/invoice';

/** Returns the 3-letter entity prefix for a company based on its country. */
export const getEntityPrefix = (company: CompanySettings | null | undefined): string => {
  if (!company) return 'CUS';
  // country?.code is the ISO alpha-2/3 code from the joined countries relation.
  // country_id is a FK (code/UUID) used as fallback.
  const code = (company.country?.code || company.country_id || '').toUpperCase();
  if (code === 'IN' || code === 'IND') return 'IND';
  if (code === 'IE' || code === 'IRL') return 'IRL';
  if (code === 'GB' || code === 'GBR' || code === 'UK') return 'GBR';
  if (code === 'US' || code === 'USA') return 'USA';
  // Only use as prefix if it looks like a short ISO code, not a UUID segment
  if (code && /^[A-Z]{2,4}$/.test(code)) return code.substring(0, 3);
  return 'CUS';
};

const getCleanCustomerCode = (customer: Customer): string => {
  if (customer.customer_code) return customer.customer_code;
  if (!customer.id) return '';
  const year = customer.created_at ? new Date(customer.created_at).getFullYear() : new Date().getFullYear();
  return `${year}-${customer.id.substring(0, 4).toUpperCase()}`;
};

/**
 * Returns one or two display IDs for a customer.
 * Format: ENTITY-YYYY-XXXX (e.g. "IND-2026-0001" or "IRL-2026-0001")
 * - Entity-specific customer → ["IND-2026-0001"]
 * - Shared customer (null company_settings_id) → ["IND-2026-0001", "IRL-2026-0001"]
 *   (same sequence number, both entity prefixes, since the customer is global)
 */
export const getCustomerDisplayIds = (
  customer: Customer,
  companies: CompanySettings[]
): string[] => {
  const code = getCleanCustomerCode(customer);
  if (!code) return [];

  if (customer.company_settings_id) {
    const company = companies.find(c => c.id === customer.company_settings_id);
    return [`${getEntityPrefix(company)}-${code}`];
  }

  // Shared: emit one ID per company that exists in the system
  return companies.map(c => `${getEntityPrefix(c)}-${code}`);
};

/** Returns a single primary display ID (first one) for compact contexts like dropdowns. Format: "IND-2026-0001" */
export const getPrimaryCustomerId = (
  customer: Customer,
  companies: CompanySettings[],
  activeCompany?: CompanySettings | null
): string => {
  const code = getCleanCustomerCode(customer);
  if (!code) return '';

  if (customer.company_settings_id) {
    const company = companies.find(c => c.id === customer.company_settings_id);
    return `${getEntityPrefix(company)}-${code}`;
  }

  // Shared: prefer the currently active entity's prefix
  const preferred = activeCompany ?? companies[0];
  return `${getEntityPrefix(preferred)}-${code}`;
};

/** Formats a label for use in select dropdowns: "[IND-2026-0001] Acme Corp" */
export const formatCustomerOption = (
  customer: Customer,
  companies: CompanySettings[],
  activeCompany?: CompanySettings | null
): string => {
  const id = getPrimaryCustomerId(customer, companies, activeCompany);
  const name = customer.company_name || customer.contact_person || 'Unnamed';
  return id ? `[${id}] ${name}` : name;
};
