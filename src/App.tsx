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

                {/* Main CRM Dashboard and all nested functional CRM views */}
                <Route path="/crm/*" element={<SimpleAdminDashboard />} />

                {/* Legacy /admin compatibility alias */}
                <Route path="/admin/*" element={<SimpleAdminDashboard />} />

                {/* Direct aliases redirecting into the CRM modules */}
                <Route path="/invoices/new" element={<Navigate to="/crm/invoices/new" replace />} />
                <Route path="/invoices/list" element={<Navigate to="/crm/invoices/list" replace />} />
                <Route path="/invoices/*" element={<Navigate to="/crm/invoices" replace />} />
                <Route path="/invoices" element={<Navigate to="/crm/invoices" replace />} />
                <Route path="/quotes" element={<Navigate to="/crm/quotes" replace />} />
                <Route path="/contracts" element={<Navigate to="/crm/contracts" replace />} />
                <Route path="/customers" element={<Navigate to="/crm/customers" replace />} />
                <Route path="/customer-360" element={<Navigate to="/crm/customer-360" replace />} />
                <Route path="/rate-cards" element={<Navigate to="/crm/rate-cards" replace />} />
                <Route path="/income" element={<Navigate to="/crm/income" replace />} />
                <Route path="/expenses" element={<Navigate to="/crm/expenses" replace />} />
                <Route path="/finance" element={<Navigate to="/crm/finance" replace />} />
                <Route path="/roles" element={<Navigate to="/crm/roles" replace />} />
                <Route path="/settings" element={<Navigate to="/crm/settings" replace />} />

                {/* Default route */}
                <Route path="/" element={<Navigate to="/crm" replace />} />
                <Route path="*" element={<Navigate to="/crm" replace />} />
              </Routes>
            </Suspense>
          </ActionProgressProvider>
        </CompanyProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

