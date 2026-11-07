/**
 * Autonomous CRM Agents & Copilot Module
 * Client Entitlement & Feature Toggle Settings Card
 */

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Shield,
  Save,
  RotateCcw,
  CheckCircle2,
  Sliders,
  DollarSign,
  FileText,
  FileSignature,
  ShieldAlert,
  Compass,
  Zap,
} from 'lucide-react';
import { copilotSettingsService } from '../services/copilotSettingsService';
import { AgentModuleSettings } from '../types';

interface AgentSettingsCardProps {
  onSaved?: () => void;
  showTitle?: boolean;
}

export const AgentSettingsCard: React.FC<AgentSettingsCardProps> = ({
  onSaved,
  showTitle = true,
}) => {
  const [settings, setSettings] = useState<AgentModuleSettings>(() =>
    copilotSettingsService.getSettings()
  );
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const unsub = copilotSettingsService.subscribe((updated) => {
      setSettings(updated);
    });
    return unsub;
  }, []);

  const handleMasterToggle = (enabled: boolean) => {
    const updated = copilotSettingsService.updateSettings({ enabled });
    setSettings(updated);
    triggerSaveFeedback();
  };

  const handleAgentToggle = (agentKey: keyof AgentModuleSettings['agents'], val: boolean) => {
    const updated = copilotSettingsService.updateSettings({
      agents: {
        ...settings.agents,
        [agentKey]: val,
      },
    });
    setSettings(updated);
    triggerSaveFeedback();
  };

  const handleThresholdChange = (
    key: keyof AgentModuleSettings['thresholds'],
    value: number
  ) => {
    const updated = copilotSettingsService.updateSettings({
      thresholds: {
        ...settings.thresholds,
        [key]: value,
      },
    });
    setSettings(updated);
  };

  const triggerSaveFeedback = () => {
    setIsSaved(true);
    if (onSaved) onSaved();
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleSaveAll = () => {
    copilotSettingsService.updateSettings(settings);
    triggerSaveFeedback();
  };

  const handleReset = () => {
    const def = copilotSettingsService.resetToDefaults();
    setSettings(def);
    triggerSaveFeedback();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      {showTitle && (
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  Autonomous AI Agents & Copilot Center
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    settings.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {settings.enabled ? 'Licensed / Active' : 'Disabled (Unpaid)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Client entitlement & autonomous execution governance controls
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isSaved && (
              <span className="flex items-center text-xs text-emerald-400 space-x-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Settings Saved</span>
              </span>
            )}
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Defaults</span>
            </button>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Master Feature Toggle */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Client Entitlement (Paid Add-on Switch)
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Toggle this master switch to turn on or off the Autonomous Copilot Center for this client. If disabled, all background agents are halted, diagnostic alerts are suppressed, and the AI Agents button is deactivated.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-slate-700">
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              onClick={() => handleMasterToggle(!settings.enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                settings.enabled ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* When disabled notice */}
        {!settings.enabled && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
            <p className="font-bold">Feature Currently Disabled for this Client</p>
            <p className="text-amber-700">
              Autonomous AI Copilot is currently turned off for this tenant. You can toggle it ON whenever the client upgrades to the Enterprise AI tier.
            </p>
          </div>
        )}

        {/* Granular Sub-Agent Switches */}
        {settings.enabled && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Active Autonomous Agents
              </h4>
              <p className="text-xs text-slate-500">
                Select which autonomous micro-agents are permitted to monitor operations and generate recommendations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Agent 1 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Deal Health & CPQ Agent</p>
                    <p className="text-[11px] text-slate-500">Monitors quote expiry & margin bounds</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.agents.dealHealth}
                  onChange={(e) => handleAgentToggle('dealHealth', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              {/* Agent 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Collections & Cash Chaser</p>
                    <p className="text-[11px] text-slate-500">Scans overdue receivables & drafts reminders</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.agents.collections}
                  onChange={(e) => handleAgentToggle('collections', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              {/* Agent 3 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <FileSignature className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Contract Compliance & Renewal</p>
                    <p className="text-[11px] text-slate-500">Tracks SLA horizons & renewal proposals</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.agents.compliance}
                  onChange={(e) => handleAgentToggle('compliance', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              {/* Agent 4 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Finance & Expense Auditor</p>
                    <p className="text-[11px] text-slate-500">Detects duplicate expenses & spend spikes</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.agents.financeAuditor}
                  onChange={(e) => handleAgentToggle('financeAuditor', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              {/* Agent 5 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between md:col-span-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Customer 360 Scout</p>
                    <p className="text-[11px] text-slate-500">Surfaces inactive accounts & retention churn risks</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.agents.customerScout}
                  onChange={(e) => handleAgentToggle('customerScout', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Threshold Configuration */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center space-x-2 mb-3">
                <Sliders className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Diagnostic Sensitivity Thresholds
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Quote Expiry Horizon (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settings.thresholds.quoteExpiryWarningDays}
                    onChange={(e) =>
                      handleThresholdChange('quoteExpiryWarningDays', parseInt(e.target.value) || 5)
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <span className="text-[10px] text-slate-400">Trigger alerts when &lt; X days</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Discount Alert Threshold (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={settings.thresholds.quoteDiscountWarningPercent}
                    onChange={(e) =>
                      handleThresholdChange(
                        'quoteDiscountWarningPercent',
                        parseInt(e.target.value) || 15
                      )
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <span className="text-[10px] text-slate-400">Alert on quotes exceeding %</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Large Expense Threshold (€)
                  </label>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={settings.thresholds.largeExpenseThreshold}
                    onChange={(e) =>
                      handleThresholdChange('largeExpenseThreshold', parseInt(e.target.value) || 5000)
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <span className="text-[10px] text-slate-400">Requires Controller signoff</span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSaveAll}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow flex items-center space-x-1.5 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Client Agent Entitlements</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentSettingsCard;

