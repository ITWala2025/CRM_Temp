import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Trash2, ChevronDown, ChevronRight,
  Link2, GitBranch, RefreshCw, AlertTriangle, X, Save,
  ArrowUpCircle, ArrowDownCircle, Minus, Network
} from 'lucide-react';
import { customerHierarchyService } from '../../services/customerHierarchyService';
import { invoiceService } from '../../services/invoiceService';
import { useToast } from '../ui/ToastProvider';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useActionProgress } from '../../contexts/ActionProgressContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useCompanyContext } from '../../contexts/CompanyContext';
import {
  RELATIONSHIP_TYPE_LABELS,
  RELATIONSHIP_TYPE_BADGE_CLASSES,
  INVERSE_RELATIONSHIP,
} from '../../types/customerHierarchy';
import type {
  CustomerRelationship,
  CustomerRelationshipType,
  CreateCustomerRelationshipData,
  CustomerHierarchyNode,
} from '../../types/customerHierarchy';
import type { Customer } from '../../types/invoice';

interface CustomerHierarchyPanelProps {
  customerId: string;
  customerName: string;
  /** Pre-loaded relationships from Customer360Data (optional — will re-fetch if not provided) */
  initialRelationships?: CustomerRelationship[];
}

const RELATIONSHIP_TYPES: CustomerRelationshipType[] = [
  'parent', 'subsidiary', 'affiliate', 'partner', 'sibling', 'division', 'franchisor', 'franchisee', 'other'
];

export const CustomerHierarchyPanel: React.FC<CustomerHierarchyPanelProps> = ({
  customerId,
  customerName,
  initialRelationships,
}) => {
  const { selectedCompany } = useCompanyContext();
  const { showSuccess, showError } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const { startAction, endAction } = useActionProgress();

  const [relationships, setRelationships] = useState<CustomerRelationship[]>(initialRelationships || []);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(!initialRelationships);
  const [treeLoading, setTreeLoading] = useState(false);
  const [hierarchyTree, setHierarchyTree] = useState<CustomerHierarchyNode | null>(null);
  const [treeExpanded, setTreeExpanded] = useState(true);

  // Add Relationship Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<{
    to_customer_id: string;
    relationship_type: CustomerRelationshipType;
    context: string;
    notes: string;
  }>({ to_customer_id: '', relationship_type: 'parent', context: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRelationships();
    loadAllCustomers();
  }, [customerId]);

  const loadRelationships = async () => {
    try {
      setLoading(true);
      const data = await customerHierarchyService.getRelationships(customerId);
      setRelationships(data);
    } catch (err) {
      console.error('Failed to load relationships:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHierarchyTree = async () => {
    try {
      setTreeLoading(true);
      const tree = await customerHierarchyService.getCustomerHierarchyTree(customerId, 2);
      setHierarchyTree(tree);
      setTreeExpanded(true);
    } catch (err) {
      showError('Failed to load hierarchy tree.');
      console.error(err);
    } finally {
      setTreeLoading(false);
    }
  };

  const loadAllCustomers = async () => {
    try {
      const res = await invoiceService.getCustomers({}, 1, 500);
      // Exclude self from the list
      setAllCustomers(res.data.filter(c => c.id !== customerId && c.is_active));
    } catch {
      // non-blocking
    }
  };

  const handleAddRelationship = async () => {
    if (!addForm.to_customer_id) { showError('Please select a counterparty company.'); return; }
    try {
      setSaving(true);
      const payload: CreateCustomerRelationshipData = {
        from_customer_id: customerId,
        to_customer_id: addForm.to_customer_id,
        relationship_type: addForm.relationship_type,
        context: addForm.context || undefined,
        notes: addForm.notes || undefined,
        company_settings_id: selectedCompany?.id || undefined,
        create_inverse: true,
      };
      await customerHierarchyService.addRelationship(payload);
      showSuccess('Relationship added successfully.');
      setShowAddModal(false);
      setAddForm({ to_customer_id: '', relationship_type: 'parent', context: '', notes: '' });
      await loadRelationships();
      if (hierarchyTree) await loadHierarchyTree();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add relationship.';
      showError(msg.includes('unique') ? 'This relationship already exists.' : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRelationship = async (rel: CustomerRelationship) => {
    const counterparty = rel.from_customer_id === customerId
      ? rel.to_customer?.company_name
      : rel.from_customer?.company_name;
    const ok = await confirm({
      title: 'Remove Relationship',
      message: `Remove the ${RELATIONSHIP_TYPE_LABELS[rel.relationship_type]} relationship with "${counterparty}"? The inverse relationship will also be deactivated.`,
      confirmText: 'Remove',
      type: 'danger'
    });
    if (!ok) return;

    startAction('Removing relationship…');
    try {
      await customerHierarchyService.deleteRelationship(rel.id);
      showSuccess('Relationship removed.');
      await loadRelationships();
      if (hierarchyTree) await loadHierarchyTree();
    } catch {
      showError('Failed to remove relationship.');
    } finally {
      endAction();
    }
  };

  // Classify relationships from the current customer's perspective
  const outgoing = relationships.filter(r => r.from_customer_id === customerId);
  const incoming = relationships.filter(r => r.to_customer_id === customerId);

  const renderRelationshipBadge = (type: CustomerRelationshipType) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${RELATIONSHIP_TYPE_BADGE_CLASSES[type]}`}>
      {RELATIONSHIP_TYPE_LABELS[type]}
    </span>
  );

  // Render a single node in the tree
  const renderTreeNode = (node: CustomerHierarchyNode, isRoot = false): React.ReactNode => {
    const isCurrentCustomer = node.customer.id === customerId;
    return (
      <div key={node.customer.id} className="relative">
        {/* Parents above */}
        {node.parents.length > 0 && (
          <div className="mb-1">
            {node.parents.map(p => (
              <div key={p.customer.id} className="ml-4 mb-1 flex items-start gap-2">
                <div className="flex flex-col items-center mt-3">
                  <ArrowUpCircle className="w-4 h-4 text-violet-400" />
                  <div className="w-px h-4 bg-violet-200" />
                </div>
                <div className="flex-1 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-violet-900 dark:text-violet-200">{p.customer.company_name}</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400">Parent Company</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Current node */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
          isCurrentCustomer
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-md'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isCurrentCustomer ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}>
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold truncate ${isCurrentCustomer ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}`}>
              {node.customer.company_name}
              {isCurrentCustomer && <span className="ml-2 text-xs font-normal text-blue-500">(current)</span>}
            </p>
          </div>
          {node.depth === 0 && <GitBranch className="w-4 h-4 text-blue-400 flex-shrink-0" />}
        </div>

        {/* Children below */}
        {node.children.length > 0 && (
          <div className="mt-1">
            {node.children.map(child => (
              <div key={child.customer.id} className="ml-4 mt-1 flex items-start gap-2">
                <div className="flex flex-col items-center mt-3">
                  <div className="w-px h-4 bg-indigo-200" />
                  <ArrowDownCircle className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">{child.customer.company_name}</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">Subsidiary / Child</p>
                  {child.children.length > 0 && (
                    <p className="text-xs text-indigo-400 mt-0.5">+{child.children.length} further sub-entities</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog {...dialogProps} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-violet-500" />
            B2B Hierarchy &amp; Relationships
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage parent companies, subsidiaries, affiliates, and partners for <strong>{customerName}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAddModal(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Relationship
          </button>
        </div>
      </div>

      {/* Hierarchy Org Chart toggle */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={async () => {
            if (!hierarchyTree) await loadHierarchyTree();
            else setTreeExpanded(v => !v);
          }}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        >
          <span className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-500" />
            Visual Org Chart (Hierarchy Tree)
          </span>
          <span className="flex items-center gap-2">
            {treeLoading && <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />}
            {hierarchyTree
              ? (treeExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
              : <ChevronRight className="w-4 h-4" />
            }
          </span>
        </button>

        {hierarchyTree && treeExpanded && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <div className="max-w-sm mx-auto space-y-2">
              {renderTreeNode(hierarchyTree, true)}
            </div>
            {/* Siblings / Partners / Affiliates row */}
            {relationships.filter(r => ['sibling', 'partner', 'affiliate'].includes(r.relationship_type)).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Associated Entities</p>
                <div className="flex flex-wrap gap-2">
                  {relationships.filter(r => ['sibling', 'partner', 'affiliate'].includes(r.relationship_type)).map(r => {
                    const peer = r.from_customer_id === customerId ? r.to_customer : r.from_customer;
                    return (
                      <div key={r.id} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5">
                        <Minus className="w-3 h-3 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{peer?.company_name}</span>
                        {renderRelationshipBadge(r.relationship_type)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Relationship List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">All Relationships</h4>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-violet-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading relationships...</p>
          </div>
        ) : relationships.length === 0 ? (
          <div className="p-10 text-center">
            <Link2 className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No relationships defined</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click "Add Relationship" to link this company to a parent, subsidiary, or partner.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {/* Outgoing (this customer is the from_customer) */}
            {outgoing.length > 0 && (
              <>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-750">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {customerName} is…
                  </p>
                </div>
                {outgoing.map(rel => (
                  <RelationshipRow
                    key={rel.id}
                    relationship={rel}
                    perspective="from"
                    onDelete={() => handleDeleteRelationship(rel)}
                    renderBadge={renderRelationshipBadge}
                  />
                ))}
              </>
            )}

            {/* Incoming (this customer is the to_customer) */}
            {incoming.length > 0 && (
              <>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-750">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Others view {customerName} as…
                  </p>
                </div>
                {incoming.map(rel => (
                  <RelationshipRow
                    key={rel.id}
                    relationship={rel}
                    perspective="to"
                    onDelete={() => handleDeleteRelationship(rel)}
                    renderBadge={renderRelationshipBadge}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Relationship Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Relationship</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Link {customerName} to another company</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              {/* Relationship Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Relationship Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={addForm.relationship_type}
                  onChange={e => setAddForm(prev => ({ ...prev, relationship_type: e.target.value as CustomerRelationshipType }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {RELATIONSHIP_TYPES.map(t => (
                    <option key={t} value={t}>{RELATIONSHIP_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {customerName} <strong>is the {RELATIONSHIP_TYPE_LABELS[addForm.relationship_type]}</strong> of the company below.
                  The inverse ({RELATIONSHIP_TYPE_LABELS[INVERSE_RELATIONSHIP[addForm.relationship_type]]}) will be auto-created.
                </p>
              </div>

              {/* Counterparty Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Counterparty Company <span className="text-red-500">*</span>
                </label>
                <select
                  value={addForm.to_customer_id}
                  onChange={e => setAddForm(prev => ({ ...prev, to_customer_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">— Select a company —</option>
                  {allCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Context / Label <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. APAC Region, Brand: IT Wala"
                  value={addForm.context}
                  onChange={e => setAddForm(prev => ({ ...prev, context: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context about this relationship…"
                  value={addForm.notes}
                  onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRelationship}
                disabled={saving || !addForm.to_customer_id}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Create Relationship'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── RelationshipRow Sub-component ──────────────────────────────────────────

interface RelationshipRowProps {
  relationship: CustomerRelationship;
  perspective: 'from' | 'to';
  onDelete: () => void;
  renderBadge: (type: CustomerRelationshipType) => React.ReactNode;
}

const RelationshipRow: React.FC<RelationshipRowProps> = ({ relationship, perspective, onDelete, renderBadge }) => {
  const counterparty = perspective === 'from' ? relationship.to_customer : relationship.from_customer;
  const displayType = perspective === 'from'
    ? relationship.relationship_type
    : INVERSE_RELATIONSHIP[relationship.relationship_type];

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
        <Building2 className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {counterparty?.company_name || 'Unknown Company'}
          </span>
          {renderBadge(displayType)}
        </div>
        {relationship.context && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            Context: {relationship.context}
          </p>
        )}
        {relationship.notes && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate italic">
            {relationship.notes}
          </p>
        )}
      </div>
      <button
        onClick={onDelete}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
        title="Remove relationship"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export default CustomerHierarchyPanel;
