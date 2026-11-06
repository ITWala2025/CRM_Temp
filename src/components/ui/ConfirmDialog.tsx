import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  loading = false
}) => {
  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-600',
          button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
          ring: 'ring-red-600/20'
        };
      case 'warning':
        return {
          icon: 'text-yellow-600',
          button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
          ring: 'ring-yellow-600/20'
        };
      case 'info':
        return {
          icon: 'text-blue-600',
          button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
          ring: 'ring-blue-600/20'
        };
      default:
        return {
          icon: 'text-red-600',
          button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
          ring: 'ring-red-600/20'
        };
    }
  };

  const colors = getColors();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title" 
      role="dialog" 
      aria-modal="true"
    >
      {/* Background overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        aria-hidden="true"
        onClick={handleBackdropClick}
      ></div>

      {/* Modal positioning container */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
        {/* Modal panel */}
        <div className="relative w-full max-w-lg bg-white rounded-lg shadow-xl transform transition-all text-left">
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            {/* Close button */}
            <div className="absolute top-4 right-4">
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md p-1"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="flex items-start pr-8">
              <div className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${colors.ring}`}>
                <AlertTriangle className={`h-6 w-6 ${colors.icon}`} aria-hidden="true" />
              </div>
              <div className="ml-4 min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-gray-900 leading-6" id="modal-title">
                  {title}
                </h3>
                <div className="mt-3">
                  <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                    {message}
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onClose}
                disabled={loading}
              >
                {cancelText}
              </button>
              <button
                type="button"
                className={`w-full inline-flex justify-center items-center rounded-md border border-transparent px-4 py-2.5 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                disabled={loading}
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
