import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/ToastProvider';
import { CompanyProvider } from './contexts/CompanyContext';
import { ActionProgressProvider } from './contexts/ActionProgressContext';
import { preloadExchangeRates } from './utils/currencyConverter';
import './utils/supabaseErrorHandler';

// CRM Admin Hub & Login
import { SimpleAdminDashboard } from './components/admin/SimpleAdminDashboard';
import { AdminLogin } from './components/admin/AdminLogin';

// Loading fallback
const LoadingFallback = () => (
  <div className="min-h-screen bg-slate-900 flex items-center justify-center">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      <p className="text-slate-400 text-sm font-medium">Loading CRM Application...</p>
    </div>
  </div>
);

export function App() {
  useEffect(() => {
    preloadExchangeRates().catch((err) => {
      console.warn('Currency exchange rate preloading failed:', err);
    });
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <CompanyProvider>
          <ActionProgressProvider>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Admin Auth */}
                <Route path="/login" element={<AdminLogin />} />

                {/* Main CRM Admin Dashboard and all nested functional CRM views */}
                <Route path="/admin/*" element={<SimpleAdminDashboard />} />

                {/* Convenience direct aliases redirecting into the CRM modules */}
                <Route path="/invoices/new" element={<Navigate to="/admin/invoices/new" replace />} />
                <Route path="/invoices/list" element={<Navigate to="/admin/invoices/list" replace />} />
                <Route path="/invoices/*" element={<Navigate to="/admin/invoices" replace />} />
                <Route path="/invoices" element={<Navigate to="/admin/invoices" replace />} />
                <Route path="/quotes" element={<Navigate to="/admin/quotes" replace />} />
                <Route path="/contracts" element={<Navigate to="/admin/contracts" replace />} />
                <Route path="/customers" element={<Navigate to="/admin/customers" replace />} />
                <Route path="/customer-360" element={<Navigate to="/admin/customer-360" replace />} />
                <Route path="/rate-cards" element={<Navigate to="/admin/rate-cards" replace />} />
                <Route path="/income" element={<Navigate to="/admin/income" replace />} />
                <Route path="/expenses" element={<Navigate to="/admin/expenses" replace />} />
                <Route path="/finance" element={<Navigate to="/admin/finance" replace />} />
                <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />

                {/* Default route */}
                <Route path="/" element={<Navigate to="/admin" replace />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </Suspense>
          </ActionProgressProvider>
        </CompanyProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

