/**
 * Autonomous CRM Agents & Copilot Module
 * Master Copilot Command Center Slide-Over
 */

import React, { useState } from 'react';
import {
  Bot,
  X,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  FileSignature,
  FileText,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Compass,
  Search,
  Filter,
  Sliders,
  History,
  Lock,
} from 'lucide-react';
import { AgentCopilotCenterProps, AgentInsight } from '../types';
import { useAgentCopilot, CopilotTab } from '../hooks/useAgentCopilot';
import { AgentStatusCards } from './AgentStatusCards';
import { AgentActionModal } from './AgentActionModal';
import { AgentAuditLogView } from './AgentAuditLogView';
import { AgentSettingsCard } from './AgentSettingsCard';

export const AgentCopilotCenter: React.FC<AgentCopilotCenterProps> = ({
  isOpen,
  onClose,
  onNavigateToEntity,
  companyId,
}) => {
  const {
    isModuleEnabled,
    insights,
    filteredInsights,
    isRunning,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    severityFilter,
    setSeverityFilter,
    agentFilter,
    setAgentFilter,
    stats,
    selectedInsightForAction,
    setSelectedInsightForAction,
    scan,
    dismissInsight,
    markApplied,
  } = useAgentCopilot(companyId);

  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);

  if (!isOpen) return null;

  const handleApply = (insight: AgentInsight) => {
    setSelectedInsightForAction(insight);
  };

  const handleDismiss = (insight: AgentInsight) => {
    dismissInsight(insight, 'Dismissed from Copilot Center');
    setNotification({
      title: 'Insight Dismissed',
      message: `${insight.title} has been moved to audit archive.`,
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const getSeverityBadge = (severity: AgentInsight['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-rose-100 text-rose-700 border border-rose-200">
            Critical
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-amber-100 text-amber-800 border border-amber-200">
            High Risk
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-700 border border-blue-200">
            Notice
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200">
            Low
          </span>
        );
    }
  };

  const getEntityIcon = (entityType: AgentInsight['entityType']) => {
    switch (entityType) {
      case 'invoice':
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case 'quote':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'contract':
        return <FileSignature className="w-4 h-4 text-purple-600" />;
      case 'expense':
        return <TrendingUp className="w-4 h-4 text-amber-600" />;
      case 'customer':
        return <Compass className="w-4 h-4 text-indigo-600" />;
      default:
        return <Bot className="w-4 h-4 text-indigo-600" />;
    }
  };

  const alertCount = insights.filter((i) => i.actionType === 'ALERT').length;
  const recCount = insights.filter((i) => i.actionType === 'RECOMMENDATION').length;
  const draftCount = insights.filter((i) => i.actionType === 'DRAFT_CREATED').length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">Autonomous CRM Copilot</h2>
                {isModuleEnabled ? (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Continuous operational surveillance & proactive human-in-the-loop workflows
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isModuleEnabled && (
              <>
                <button
                  onClick={scan}
                  disabled={isRunning}
                  title="Run Realtime Diagnostics"
                  className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
                <button
                  onClick={() => setActiveTab(activeTab === 'settings' ? 'all' : 'settings')}
                  title="Agent Copilot Settings"
                  className={`p-2 rounded-lg transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* If Module is Disabled for this Client */}
        {!isModuleEnabled ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Lock className="w-8 h-8 text-slate-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Autonomous AI Copilot Feature Disabled
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                This capability is turned off in client configuration (Enterprise Add-on). To activate autonomous scanning, deal health tracking, and collections chaser for this client, enable the feature in Settings.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              Open Client Settings to Enable
            </button>
          </div>
        ) : (
          <>
            {/* 5 Agent Status Pods */}
            <AgentStatusCards
              stats={stats}
              selectedAgent={agentFilter}
              onSelectAgent={setAgentFilter}
              isScanning={isRunning}
            />

            {/* Filter Tabs */}
            <div className="px-6 pt-3 flex items-center justify-between border-b border-slate-200">
              <div className="flex space-x-3">
                {(
                  [
                    { id: 'all', label: `All (${insights.length})` },
                    { id: 'alerts', label: `Alerts (${alertCount})` },
                    { id: 'recommendations', label: `Recommendations (${recCount})` },
                    { id: 'drafts', label: `Drafts (${draftCount})` },
                    { id: 'audit', label: 'Audit Trail' },
                    { id: 'settings', label: 'Settings' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as CopilotTab)}
                    className={`pb-2.5 text-xs font-bold capitalize border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {agentFilter !== 'all' && (
                <button
                  onClick={() => setAgentFilter('all')}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 pb-2.5"
                >
                  Clear Agent Filter
                </button>
              )}
            </div>

            {/* Notification Banner */}
            {notification && (
              <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold">{notification.title}:</span> {notification.message}
                  </div>
                </div>
                <button onClick={() => setNotification(null)}>
                  <X className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>
            )}

            {/* Body View Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'audit' ? (
                <AgentAuditLogView />
              ) : activeTab === 'settings' ? (
                <AgentSettingsCard onSaved={() => setNotification({ title: 'Success', message: 'Settings saved' })} />
              ) : (
                <div className="space-y-4">
                  {/* Search and Severity Filter Bar */}
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search recommendations, customers, invoices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <select
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value as any)}
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="all">All Severities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High Risk</option>
                      <option value="medium">Notice</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  {/* Insights Stream */}
                  {isRunning ? (
                    <div className="py-16 flex flex-col items-center justify-center space-y-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                      <p className="text-xs text-slate-500">Autonomous agents scanning ledger & events...</p>
                    </div>
                  ) : filteredInsights.length === 0 ? (
                    <div className="py-16 text-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-slate-800">All Operations Optimal</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        No active operational anomalies, overdue escalation flags, or expired deal alerts detected across entities.
                      </p>
                    </div>
                  ) : (
                    filteredInsights.map((insight) => (
                      <div
                        key={insight.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="p-1 rounded bg-slate-100">{getEntityIcon(insight.entityType)}</span>
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              {insight.agentLabel}
                            </span>
                          </div>
                          {getSeverityBadge(insight.severity)}
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{insight.title}</h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{insight.description}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            {new Date(insight.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleDismiss(insight)}
                              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => handleApply(insight)}
                              className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded shadow-xs flex items-center space-x-1 transition-colors"
                            >
                              <span>Review Action</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Human-in-the-loop Action Review Modal */}
      <AgentActionModal
        insight={selectedInsightForAction}
        isOpen={Boolean(selectedInsightForAction)}
        onClose={() => setSelectedInsightForAction(null)}
        onApplied={(id) => {
          markApplied(id);
          setNotification({
            title: 'Action Executed',
            message: 'Agent recommendation successfully applied to live CRM ledger.',
          });
        }}
        onNavigateToEntity={(type, id) => {
          if (onNavigateToEntity) {
            onNavigateToEntity(type, id);
          }
        }}
      />
    </div>
  );
};

export default AgentCopilotCenter;

