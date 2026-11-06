import React, { useState, useEffect } from 'react';
import {
  Bot,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  FileSignature,
  FileText,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { agentService, AgentInsight } from '../../services/agentService';
import { useCompanyContext } from '../../contexts/CompanyContext';
import { useToast } from '../ui/ToastProvider';

interface AgentCopilotCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToEntity?: (entityType: string, entityId: string) => void;
}

export const AgentCopilotCenter: React.FC<AgentCopilotCenterProps> = ({
  isOpen,
  onClose,
  onNavigateToEntity,
}) => {
  const { selectedCompany } = useCompanyContext();
  const { showSuccess, showInfo } = useToast();
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'alerts' | 'recommendations' | 'drafts'>('all');

  const loadAgentInsights = async () => {
    setIsRunning(true);
    try {
      const results = await agentService.runAllAgents(selectedCompany?.id);
      setInsights(results);
    } catch (err) {
      console.error('Agent scan error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAgentInsights();
    }
  }, [isOpen, selectedCompany]);

  if (!isOpen) return null;

  const handleApply = (insight: AgentInsight) => {
    setInsights((prev) => prev.filter((i) => i.id !== insight.id));
    showSuccess('Agent Action Executed', `Applied recommendation: ${insight.title}`);
    if (onNavigateToEntity) {
      onNavigateToEntity(insight.entityType, insight.entityId);
    }
  };

  const handleDismiss = (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    showInfo('Insight Dismissed', 'Recommendation moved to archive');
  };

  const filteredInsights = insights.filter((i) => {
    if (activeTab === 'alerts') return i.actionType === 'ALERT';
    if (activeTab === 'recommendations') return i.actionType === 'RECOMMENDATION';
    if (activeTab === 'drafts') return i.actionType === 'DRAFT_CREATED';
    return true;
  });

  const getSeverityBadge = (severity: AgentInsight['severity']) => {
    switch (severity) {
      case 'critical':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700 border border-red-200">Critical</span>;
      case 'high':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200">High Risk</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700 border border-blue-200">Notice</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200">Low</span>;
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
      default:
        return <Bot className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">Autonomous CRM Agents</h2>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-xs text-slate-400">Continuous background operational monitoring</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadAgentInsights}
              disabled={isRunning}
              title="Run Realtime Diagnostics"
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4 Agent Status Pods */}
        <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Deal Health Agent</p>
              <p className="text-[10px] text-emerald-600 font-medium">Monitoring Margins</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Collections Agent</p>
              <p className="text-[10px] text-emerald-600 font-medium">Tracking Overdue</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600">
              <FileSignature className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Compliance Agent</p>
              <p className="text-[10px] text-emerald-600 font-medium">Tracking Renewals</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Finance Auditor</p>
              <p className="text-[10px] text-emerald-600 font-medium">Auditing Expenses</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 pt-3 flex space-x-2 border-b border-slate-200">
          {(['all', 'alerts', 'recommendations', 'drafts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-xs font-semibold capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Insights Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isRunning ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="text-sm text-slate-500">Autonomous agents scanning ledger & events...</p>
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
                className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="p-1 rounded bg-slate-100">{getEntityIcon(insight.entityType)}</span>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {insight.agentLabel}
                    </span>
                  </div>
                  {getSeverityBadge(insight.severity)}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{insight.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{insight.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {new Date(insight.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDismiss(insight.id)}
                      className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleApply(insight)}
                      className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded shadow-sm flex items-center space-x-1 transition-colors"
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
      </div>
    </div>
  );
};

export default AgentCopilotCenter;

