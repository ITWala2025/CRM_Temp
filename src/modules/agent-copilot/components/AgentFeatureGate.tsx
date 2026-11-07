/**
 * Autonomous CRM Agents & Copilot Module
 * Feature Entitlement Gate & Guard
 */

import React, { useState, useEffect } from 'react';
import { Bot, Lock, ArrowRight, Settings } from 'lucide-react';
import { copilotSettingsService } from '../services/copilotSettingsService';

interface AgentFeatureGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onNavigateToSettings?: () => void;
}

export const AgentFeatureGate: React.FC<AgentFeatureGateProps> = ({
  children,
  fallback,
  onNavigateToSettings,
}) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() =>
    copilotSettingsService.isModuleEnabled()
  );

  useEffect(() => {
    const unsub = copilotSettingsService.subscribe((settings) => {
      setIsEnabled(settings.enabled);
    });
    return unsub;
  }, []);

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-7 h-7 text-slate-500" />
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">
        Autonomous AI Agents Module Inactive
      </h3>
      <p className="text-xs text-slate-500 mb-6 leading-relaxed">
        The Autonomous AI Copilot is an Enterprise Tier capability. This client does not currently have this paid feature enabled in client configuration.
      </p>
      {onNavigateToSettings && (
        <button
          onClick={onNavigateToSettings}
          className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Enable Module in Settings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default AgentFeatureGate;

