// TypeScript types for B2B Hierarchical Customer Structure
// Migration: 033_customer_b2b_hierarchy.sql

import type { Customer } from './invoice';
import type { CustomerContact } from './customerContact';

// ------------------------------------------------------------------
// Company ↔ Company Relationship Types
// ------------------------------------------------------------------

export type CustomerRelationshipType =
  | 'parent'
  | 'subsidiary'
  | 'affiliate'
  | 'partner'
  | 'sibling'
  | 'division'
  | 'franchisor'
  | 'franchisee'
  | 'other';

/** Human-readable labels for each relationship type */
export const RELATIONSHIP_TYPE_LABELS: Record<CustomerRelationshipType, string> = {
  parent:       'Parent Company',
  subsidiary:   'Subsidiary',
  affiliate:    'Affiliate',
  partner:      'Strategic Partner',
  sibling:      'Sibling / Sister Company',
  division:     'Division / Business Unit',
  franchisor:   'Franchisor',
  franchisee:   'Franchisee',
  other:        'Other',
};

/** Tailwind badge classes for each relationship type */
export const RELATIONSHIP_TYPE_BADGE_CLASSES: Record<CustomerRelationshipType, string> = {
  parent:       'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300',
  subsidiary:   'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  affiliate:    'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300',
  partner:      'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  sibling:      'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300',
  division:     'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300',
  franchisor:   'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  franchisee:   'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
  other:        'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300',
};

/** The inverse relationship type. Adding A→parent→B auto-creates B→subsidiary→A */
export const INVERSE_RELATIONSHIP: Record<CustomerRelationshipType, CustomerRelationshipType> = {
  parent:       'subsidiary',
  subsidiary:   'parent',
  affiliate:    'affiliate',
  partner:      'partner',
  sibling:      'sibling',
  division:     'parent',
  franchisor:   'franchisee',
  franchisee:   'franchisor',
  other:        'other',
};

export interface CustomerRelationship {
  id: string;
  from_customer_id: string;
  to_customer_id: string;
  relationship_type: CustomerRelationshipType;
  context?: string | null;
  company_settings_id?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  from_customer?: Customer;
  to_customer?: Customer;
}

export interface CreateCustomerRelationshipData {
  from_customer_id: string;
  to_customer_id: string;
  relationship_type: CustomerRelationshipType;
  context?: string;
  company_settings_id?: string;
  notes?: string;
  /** If true, also creates the inverse relationship automatically (default: true) */
  create_inverse?: boolean;
}

export interface UpdateCustomerRelationshipData {
  relationship_type?: CustomerRelationshipType;
  context?: string;
  notes?: string;
  is_active?: boolean;
}

export interface CustomerRelationshipFilters {
  customer_id?: string;          // fetch all relationships involving this customer (from OR to)
  relationship_type?: CustomerRelationshipType;
  company_settings_id?: string;
  is_active?: boolean;
}

// ------------------------------------------------------------------
// Contact ↔ Company Cross-Link Types
// ------------------------------------------------------------------

export interface ContactCustomerLink {
  id: string;
  contact_id: string;
  customer_id: string;
  role?: string | null;
  is_primary: boolean;
  context?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: CustomerContact;
  customer?: Customer;
}

export interface CreateContactCustomerLinkData {
  contact_id: string;
  customer_id: string;
  role?: string;
  is_primary?: boolean;
  context?: string;
}

export interface UpdateContactCustomerLinkData {
  role?: string;
  is_primary?: boolean;
  context?: string;
  is_active?: boolean;
}

// ------------------------------------------------------------------
// Hierarchy Tree Node (for visual org chart)
// ------------------------------------------------------------------

export interface CustomerHierarchyNode {
  customer: Customer;
  /** All relationships FROM this node */
  relationships: CustomerRelationship[];
  /** Customers that are parents of this node */
  parents: CustomerHierarchyNode[];
  /** Customers that are children/subsidiaries/etc. of this node */
  children: CustomerHierarchyNode[];
  /** Depth from the root (0 = root / current customer) */
  depth: number;
}
