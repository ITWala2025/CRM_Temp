import React, { createContext, useContext, useState } from 'react';

interface ActionProgressContextValue {
  startAction: (label: string) => void;
  endAction: () => void;
}

const ActionProgressContext = createContext<ActionProgressContextValue>({
  startAction: () => {},
  endAction: () => {},
});

/**
 * Hook to get startAction / endAction from any component in the tree.
 *
 * Usage:
 *   const { startAction, endAction } = useActionProgress();
 *   startAction('Deleting record…');
 *   try { await service.delete(id); } finally { endAction(); }
 */
export const useActionProgress = () => useContext(ActionProgressContext);

/**
 * Wrap the app (or admin section) with this provider.
 * It renders the processing pill overlay once, globally.
 */
export const ActionProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState<string | null>(null);

  const startAction = (label: string) => setMessage(label);
  const endAction = () => setMessage(null);

  return (
    <ActionProgressContext.Provider value={{ startAction, endAction }}>
      {children}

      {/* ── Global action-in-progress pill ───────────────────────────────── */}
      {message && (
        <div className="fixed inset-0 z-[60] pointer-events-none flex items-end justify-center pb-8 px-4">
          <div className="pointer-events-auto flex items-center gap-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700">
            {/* Dual-ring spinner */}
            <div className="relative flex-shrink-0 w-5 h-5">
              <div className="absolute inset-0 rounded-full border-2 border-white/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin" />
            </div>
            <span className="text-sm font-medium tracking-wide">{message}</span>
          </div>
        </div>
      )}
    </ActionProgressContext.Provider>
  );
};
