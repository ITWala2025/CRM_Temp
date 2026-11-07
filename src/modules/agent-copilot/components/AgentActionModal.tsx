/**
 * Autonomous CRM Agents & Copilot Module
 * Human-in-the-Loop Action Execution Dialog
 */

import React, { useState } from 'react';
import {
  X,
  Mail,
  Send,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Calendar,
  FileSignature,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Building2,
} from 'lucide-react';
import { AgentInsight } from '../types';
import { agentActionService } from '../services/agentActionService';

interface AgentActionModalProps {
  insight: AgentInsight | null;
  isOpen: boolean;
  onClose: () => void;
  onApplied: (insightId: string) => void;
  onNavigateToEntity?: (entityType: string, entityId: string) => void;
}

export const AgentActionModal: React.FC<AgentActionModalProps> = ({
  insight,
  isOpen,
  onClose,
  onApplied,
  onNavigateToEntity,
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Email draft state
  const [emailTo, setEmailTo] = useState(insight?.metadata?.draftRecipient || 'accounts@client.com');
  const [emailSubject, setEmailSubject] = useState(
    insight?.metadata?.draftSubject || 'Payment Reminder: Outstanding Invoice'
  );
  const [emailBody, setEmailBody] = useState(insight?.metadata?.draftBody || '');

  // Discount adjustment state
  const [selectedDiscountPercent, setSelectedDiscountPercent] = useState<number>(
    insight?.metadata?.suggestedDiscountPercent || 10
  );

  // Reset state when insight changes
  React.useEffect(() => {
    if (insight) {
      setEmailTo(insight.metadata?.draftRecipient || 'accounts@client.com');
      setEmailSubject(insight.metadata?.draftSubject || 'Payment Reminder: Outstanding Invoice');
      setEmailBody(insight.metadata?.draftBody || '');
      setSelectedDiscountPercent(insight.metadata?.suggestedDiscountPercent || 10);
      setSuccessMessage(null);
      setIsExecuting(false);
    }
  }, [insight]);

  if (!isOpen || !insight) return null;

  const handleDispatchEmail = async () => {
    setIsExecuting(true);
    try {
      const res = await agentActionService.dispatchPaymentReminder(insight, {
        to: emailTo,
        subject: emailSubject,
        body: emailBody,
      });
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          onApplied(insight.id);
          onClose();
        }, 1200);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleApplyDiscount = async () => {
    setIsExecuting(true);
    try {
      const res = await agentActionService.applyQuoteDiscount(insight, selectedDiscountPercent);
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          onApplied(insight.id);
          onClose();
          if (onNavigateToEntity) {
            onNavigateToEntity('quote', insight.entityId);
          }
        }, 1200);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExtendQuote = async () => {
    setIsExecuting(true);
    try {
      const res = await agentActionService.extendQuoteValidity(insight, 14);
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          onApplied(insight.id);
          onClose();
        }, 1200);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleGenerateRenewalQuote = async () => {
    setIsExecuting(true);
    try {
      const res = await agentActionService.generateRenewalQuote(insight);
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          onApplied(insight.id);
          onClose();
          if (onNavigateToEntity && res.data?.id) {
            onNavigateToEntity('quote', res.data.id);
          }
        }, 1200);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExpenseDuplicateAction = async (action: 'mark_duplicate_rejected' | 'approve_exception') => {
    setIsExecuting(true);
    try {
      const res = await agentActionService.flagExpenseAnomaly(insight, action);
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          onApplied(insight.id);
          onClose();
        }, 1200);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                Human-in-the-loop Action Review
              </span>
              <h3 className="text-base font-bold text-white truncate max-w-md">{insight.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {successMessage ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Action Successfully Executed</h4>
              <p className="text-xs text-slate-600 max-w-md">{successMessage}</p>
            </div>
          ) : (
            <>
              {/* Contextual Description Banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3 text-xs text-slate-700">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">Recommendation Context:</p>
                  <p className="text-slate-600 leading-relaxed">{insight.description}</p>
                </div>
              </div>

              {/* Case 1: Collections Follow-up Email Review */}
              {insight.agentName === 'CollectionsAgent' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                    <div>
                      <span className="text-emerald-700 font-medium">Days Overdue:</span>
                      <p className="text-sm font-bold text-emerald-950">
                        {insight.metadata?.daysOverdue || 'N/A'} Days
                      </p>
                    </div>
                    <div>
                      <span className="text-emerald-700 font-medium">Outstanding Balance:</span>
                      <p className="text-sm font-bold text-emerald-950">
                        €{insight.metadata?.balanceDue?.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Recipient Email</label>
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Synthesized Email Body</label>
                      <span className="text-[10px] text-slate-400">Includes Verified Banking Coordinates</span>
                    </div>
                    <textarea
                      rows={6}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
                    />
                  </div>
                </div>
              )}

              {/* Case 2: Deal Health Quote Discount & Expiry */}
              {insight.agentName === 'DealHealthAgent' && (
                <div className="space-y-4">
                  {insight.metadata?.originalDiscountPercent ? (
                    <div>
                      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-blue-800 font-medium">Original Discount Applied</p>
                          <p className="text-lg font-black text-rose-600">
                            {insight.metadata.originalDiscountPercent}%
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-xs text-blue-800 font-medium">Recommended Discount Bound</p>
                          <p className="text-lg font-black text-emerald-600">
                            {selectedDiscountPercent}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Select Adjusted Discount Percentage
                        </label>
                        <div className="flex space-x-2">
                          {[5, 10, 12, 15].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setSelectedDiscountPercent(pct)}
                              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                                selectedDiscountPercent === pct
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {pct}% Cap
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100 space-y-2">
                      <p className="text-xs font-bold text-amber-900">Validity Horizon Reached</p>
                      <p className="text-xs text-amber-800">
                        This quote reaches expiration in {insight.metadata?.daysToExpiry} day(s). You can automatically grant a 14-day grace extension.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Case 3: Contract Compliance Renewal */}
              {insight.agentName === 'ComplianceAgent' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-3">
                    <div className="flex items-center space-x-2">
                      <FileSignature className="w-5 h-5 text-purple-600" />
                      <h4 className="text-xs font-bold text-purple-950">Auto-Renewal Quote Generator</h4>
                    </div>
                    <p className="text-xs text-purple-800">
                      The Contract Compliance Agent has structured a 12-month extension proposal based on current contract baseline (€{insight.metadata?.contractValue?.toLocaleString() || '15,000'}).
                    </p>
                  </div>
                </div>
              )}

              {/* Case 4: Finance Anomaly Expense Duplicate */}
              {insight.agentName === 'FinanceAuditor' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100 flex items-start space-x-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">Duplicate Transaction Detected</h4>
                      <p className="text-xs text-amber-800 mt-1">
                        Matched Vendor: <span className="font-semibold">{insight.metadata?.matchedVendor || 'Vendor'}</span> | Amount: <span className="font-semibold">€{insight.metadata?.matchedAmount?.toLocaleString() || '0'}</span> | Date: {insight.metadata?.matchedDate}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Case 5: Customer Scout */}
              {insight.agentName === 'CustomerScout' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start space-x-3">
                    <Building2 className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950">Dormant Account Re-engagement</h4>
                      <p className="text-xs text-indigo-800 mt-1">
                        Enterprise account inactive for {insight.metadata?.inactiveDays} days. Schedule proactive relationship review to safeguard ARR.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!successMessage && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isExecuting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>

            <div className="flex space-x-2">
              {insight.agentName === 'CollectionsAgent' && (
                <button
                  onClick={handleDispatchEmail}
                  disabled={isExecuting}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isExecuting ? 'Dispatching...' : 'Dispatch Payment Reminder Email'}</span>
                </button>
              )}

              {insight.agentName === 'DealHealthAgent' &&
                (insight.metadata?.originalDiscountPercent ? (
                  <button
                    onClick={handleApplyDiscount}
                    disabled={isExecuting}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>{isExecuting ? 'Applying...' : `Cap Discount to ${selectedDiscountPercent}%`}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleExtendQuote}
                    disabled={isExecuting}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{isExecuting ? 'Extending...' : 'Grant 14-Day Extension'}</span>
                  </button>
                ))}

              {insight.agentName === 'ComplianceAgent' && (
                <button
                  onClick={handleGenerateRenewalQuote}
                  disabled={isExecuting}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <FileSignature className="w-3.5 h-3.5" />
                  <span>{isExecuting ? 'Synthesizing...' : 'Generate Draft Renewal Quote'}</span>
                </button>
              )}

              {insight.agentName === 'FinanceAuditor' && (
                <>
                  <button
                    onClick={() => handleExpenseDuplicateAction('approve_exception')}
                    disabled={isExecuting}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Approve Exception
                  </button>
                  <button
                    onClick={() => handleExpenseDuplicateAction('mark_duplicate_rejected')}
                    disabled={isExecuting}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow transition-colors disabled:opacity-50"
                  >
                    Mark as Duplicate & Reject
                  </button>
                </>
              )}

              {insight.agentName === 'CustomerScout' && (
                <button
                  onClick={() => {
                    onApplied(insight.id);
                    onClose();
                    if (onNavigateToEntity) {
                      onNavigateToEntity('customer-360', insight.entityId);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow flex items-center space-x-1.5 transition-colors"
                >
                  <span>Open Customer 360 Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentActionModal;

