import React, { createContext, useContext, useState, ReactNode } from 'react';
import ToastComponent, { Toast } from './Toast';

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  const showToast = (toast: Omit<Toast, 'id'>) => {
    const newToast: Toast = {
      ...toast,
      id: generateId(),
      duration: toast.duration || 5000,
    };
    
    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (message: string, title?: string) => {
    showToast({ type: 'success', message, title });
  };

  const showError = (message: string, title?: string) => {
    showToast({ type: 'error', message, title });
  };

  const showWarning = (message: string, title?: string) => {
    showToast({ type: 'warning', message, title });
  };

  const showInfo = (message: string, title?: string) => {
    showToast({ type: 'info', message, title });
  };

  const value: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 min-w-[320px] max-w-md">
        {toasts.map(toast => (
          <ToastComponent
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
