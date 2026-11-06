import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { invoiceService } from '../services/invoiceService';
import type { CompanySettings } from '../types/invoice';
import { supabase } from '../config/supabase';

interface CompanyContextType {
  companies: CompanySettings[];
  selectedCompany: CompanySettings | null;
  loading: boolean;
  error: string | null;
  selectCompany: (id: string) => void;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<CompanySettings[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoiceService.getCompanySettings();
      setCompanies(prev => {
        if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
        return data;
      });
      setSelectedCompany(prev => {
        let next: CompanySettings | null = null;
        if (prev && data.some(c => c.id === prev.id)) {
          next = data.find(c => c.id === prev.id) || prev;
        } else {
          const storedId = localStorage.getItem('kdadks_selected_company_id');
          if (storedId && data.some(c => c.id === storedId)) {
            next = data.find(c => c.id === storedId) || null;
          } else {
            next = data.find(c => c.is_default) || data[0] || null;
          }
        }
        if (next) {
          localStorage.setItem('kdadks_selected_company_id', next.id);
        }
        if (prev && next && JSON.stringify(prev) === JSON.stringify(next)) {
          return prev;
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to load company settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        loadCompanies();
      } else if (event === 'SIGNED_OUT') {
        setCompanies([]);
        setSelectedCompany(null);
        localStorage.removeItem('kdadks_selected_company_id');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [loadCompanies]);

  const selectCompany = (id: string) => {
    const found = companies.find(c => c.id === id) || null;
    setSelectedCompany(found);
    if (found) {
      localStorage.setItem('kdadks_selected_company_id', found.id);
    } else {
      localStorage.removeItem('kdadks_selected_company_id');
    }
  };

  return (
    <CompanyContext.Provider value={{ companies, selectedCompany, loading, error, selectCompany, refreshCompanies: loadCompanies }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompanyContext = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompanyContext must be used within CompanyProvider');
  return ctx;
};
