import React, { useState, useEffect } from 'react';
import {
  UserCircle, Building2, Plus, Trash2, RefreshCw, X, Save,
  Link2, Mail, Phone, Briefcase, ChevronDown, ChevronRight,
  Users, Globe, Tag
} from 'lucide-react';
import { customerHierarchyService } from '../../services/customerHierarchyService';
import { invoiceService } from '../../services/invoiceService';
import { useToast } from '../ui/ToastProvider';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useActionProgress } from '../../contexts/ActionProgressContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import { ROLE_LABELS, ROLE_BADGE_CLASSES } from '../../types/customerContact';
import type { CustomerContact } from '../../types/customerContact';
import type {
  ContactCustomerLink,
  CreateContactCustomerLinkData,
} from '../../types/customerHierarchy';
import type { Customer } from '../../types/invoice';

interface ContactNetworkPanelProps {
  customerId: string;
  customerName: string;
  /** Contacts directly belonging to this customer */
  contacts: CustomerContact[];
  /** Pre-loaded cross-links from 360 data */
  initialContactLinks?: ContactCustomerLink[];
}

export const ContactNetworkPanel: React.FC<ContactNetworkPanelProps> = ({
  customerId,
  customerName,
  contacts,
  initialContactLinks,
}) => {
  const { showSuccess, showError } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const { startAction, endAction } = useActionProgress();

  const [contactLinks, setContactLinks] = useState<ContactCustomerLink[]>(initialContactLinks || []);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  // Per-contact cross-links (loaded on expand)
  const [perContactLinks, setPerContactLinks] = useState<Record<string, ContactCustomerLink[]>>({});

  // Add Cross-Link Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<{
    contact_id: string;
    customer_id: string;
    role: string;
    context: string;
    is_primary: boolean;
  }>({ contact_id: '', customer_id: '', role: '', context: '', is_primary: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAllCustomers();
  }, [customerId]);

  const loadAllCustomers = async () => {
    try {
      const res = await invoiceService.getCustomers({}, 1, 500);
      setAllCustomers(res.data.filter(c => c.id !== customerId && c.is_active));
    } catch {
      // non-blocking
    }
  };

  const toggleContactExpand = async (contactId: string) => {
    if (expandedContactId === contactId) {
      setExpandedContactId(null);
      return;
    }
    setExpandedContactId(contactId);

    // Load cross-links for this specific contact if not already fetched
    if (!perContactLinks[contactId]) {
      try {
        const links = await customerHierarchyService.getContactCustomerLinks(contactId);
        setPerContactLinks(prev => ({ ...prev, [contactId]: links }));
      } catch {
        setPerContactLinks(prev => ({ ...prev, [contactId]: [] }));
      }
    }
  };

  const handleAddCrossLink = async () => {
    if (!addForm.contact_id) { showError('Please select a contact.'); return; }
    if (!addForm.customer_id) { showError('Please select a company to link to.'); return; }
    try {
      setSaving(true);
      const payload: CreateContactCustomerLinkData = {
        contact_id:  addForm.contact_id,
        customer_id: addForm.customer_id,
        role:        addForm.role || undefined,
        context:     addForm.context || undefined,
        is_primary:  addForm.is_primary,
      };
      await customerHierarchyService.addContactCustomerLink(payload);
      showSuccess('Contact linked to company successfully.');
      setShowAddModal(false);
      setAddForm({ contact_id: '', customer_id: '', role: '', context: '', is_primary: false });

      // Refresh links for this contact
      if (perContactLinks[addForm.contact_id] !== undefined) {
        const links = await customerHierarchyService.getContactCustomerLinks(addForm.contact_id);
        setPerContactLinks(prev => ({ ...prev, [addForm.contact_id]: links }));
      }

      // Refresh the overall contactLinks list
      const updated = await customerHierarchyService.getLinksForCustomer(customerId);
      setContactLinks(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add link.';
      showError(msg.includes('unique') ? 'This contact is already linked to that company.' : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCrossLink = async (link: ContactCustomerLink) => {
    const contactName = contacts.find(c => c.id === link.contact_id)?.name || 'contact';
    const companyName = allCustomers.find(c => c.id === link.customer_id)?.company_name || 'company';
    const ok = await confirm({
      title: 'Remove Cross-Link',
      message: `Remove the cross-company link between "${contactName}" and "${companyName}"?`,
      confirmText: 'Remove',
      type: 'danger'
    });
    if (!ok) return;

    startAction('Removing cross-link…');
    try {
      await customerHierarchyService.removeContactCustomerLink(link.id);
      showSuccess('Cross-link removed.');

      // Refresh links for this contact
      const links = await customerHierarchyService.getContactCustomerLinks(link.contact_id);
      setPerContactLinks(prev => ({ ...prev, [link.contact_id]: links }));

      const updated = await customerHierarchyService.getLinksForCustomer(customerId);
      setContactLinks(updated);
    } catch {
      showError('Failed to remove cross-link.');
    } finally {
      endAction();
    }
  };

  // Incoming cross-links: contacts from other companies linked to this customer
  const incomingLinks = contactLinks.filter(l => l.customer_id === customerId);

  return (
    <div className="space-y-6">
      <ConfirmDialog {...dialogProps} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Contact Network
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage contacts that span multiple companies. A contact can serve many companies with different roles.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Link Contact to Company
        </button>
      </div>

      {/* Contacts from this customer — with cross-link expansion */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Contacts of {customerName}
          </h4>
          <span className="text-xs text-gray-400">{contacts.length} contacts</span>
        </div>

        {contacts.length === 0 ? (
          <div className="p-8 text-center">
            <UserCircle className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No contacts yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {contacts.map(contact => {
              const isExpanded = expandedContactId === contact.id;
              const crossLinks = perContactLinks[contact.id] || [];
              // Filter out the link to self (the primary company)
              const otherLinks = crossLinks.filter(l => l.customer_id !== contact.customer_id);

              return (
                <div key={contact.id}>
                  {/* Contact Row */}
                  <button
                    onClick={() => toggleContactExpand(contact.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      contact.is_primary
                        ? 'bg-gradient-to-br from-violet-500 to-indigo-500'
                        : 'bg-gradient-to-br from-gray-400 to-gray-500'
                    }`}>
                      <span className="text-white text-xs font-bold">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{contact.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE_CLASSES[contact.role]}`}>
                          {ROLE_LABELS[contact.role]}
                        </span>
                        {contact.is_primary && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {contact.job_title && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> {contact.job_title}
                          </span>
                        )}
                        {contact.email && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {contact.email}
                          </span>
                        )}
                        {contact.phone && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {contact.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {perContactLinks[contact.id] && otherLinks.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
                          <Link2 className="w-3 h-3" />
                          {otherLinks.length} co.
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {/* Cross-link Expansion Panel */}
                  {isExpanded && (
                    <div className="bg-indigo-50/40 dark:bg-indigo-900/10 border-t border-indigo-100 dark:border-indigo-800 px-4 pb-3 pt-2">
                      <div className="ml-12 space-y-2">
                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          Cross-Company Links
                        </p>

                        {/* Primary company link */}
                        <div className="flex items-center gap-2 py-1.5 px-3 bg-white dark:bg-gray-700 rounded-lg border border-indigo-200 dark:border-indigo-700">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{customerName}</span>
                          <span className="ml-auto text-xs text-indigo-500 italic flex-shrink-0">primary</span>
                        </div>

                        {/* Other linked companies */}
                        {otherLinks.map(link => {
                          const linkedCo = allCustomers.find(c => c.id === link.customer_id);
                          return (
                            <div key={link.id} className="flex items-center gap-2 py-1.5 px-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 group">
                              <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-700 dark:text-gray-200 truncate flex-1">
                                {linkedCo?.company_name || 'Unknown Company'}
                              </span>
                              {link.role && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Tag className="w-3 h-3" /> {link.role}
                                </span>
                              )}
                              {link.context && (
                                <span className="text-xs italic text-gray-400">{link.context}</span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveCrossLink(link); }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all flex-shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}

                        {perContactLinks[contact.id] && otherLinks.length === 0 && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">
                            No other companies linked. Use "Link Contact to Company" to add.
                          </p>
                        )}

                        {!perContactLinks[contact.id] && (
                          <div className="flex items-center gap-2 py-1">
                            <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                            <span className="text-xs text-gray-500">Loading…</span>
                          </div>
                        )}

                        {/* Quick Add for this contact */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddForm(prev => ({ ...prev, contact_id: contact.id }));
                            setShowAddModal(true);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                        >
                          <Plus className="w-3 h-3" />
                          Link to another company
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Incoming Contact Links (contacts from other companies that are also linked HERE) */}
      {incomingLinks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              External Contacts Linked to {customerName}
            </h4>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Contacts from other companies who are also associated with this account.
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {incomingLinks.map(link => {
              const contact = link.contact as CustomerContact | undefined;
              return (
                <div key={link.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {(contact?.name || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{contact?.name || 'Unknown'}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {link.role && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {link.role}
                        </span>
                      )}
                      {contact?.email && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {contact.email}
                        </span>
                      )}
                      {link.context && (
                        <span className="text-xs italic text-gray-400">{link.context}</span>
                      )}
                      {link.is_primary && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full">Primary</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveCrossLink(link)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Cross-Link Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Link Contact to Company</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Enable a contact to serve multiple companies with different roles.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Select Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact <span className="text-red-500">*</span>
                </label>
                <select
                  value={addForm.contact_id}
                  onChange={e => setAddForm(prev => ({ ...prev, contact_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select a contact —</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.job_title || c.role})</option>
                  ))}
                </select>
              </div>

              {/* Select Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link to Company <span className="text-red-500">*</span>
                </label>
                <select
                  value={addForm.customer_id}
                  onChange={e => setAddForm(prev => ({ ...prev, customer_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select a company —</option>
                  {allCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              {/* Role at linked company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role at linked company <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Technical Lead, Legal Rep, Account Manager"
                  value={addForm.role}
                  onChange={e => setAddForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Context <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Legal Rep for APAC, Billing contact for IE entity"
                  value={addForm.context}
                  onChange={e => setAddForm(prev => ({ ...prev, context: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Is Primary */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addForm.is_primary}
                  onChange={e => setAddForm(prev => ({ ...prev, is_primary: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Primary point-of-contact at the linked company</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCrossLink}
                disabled={saving || !addForm.contact_id || !addForm.customer_id}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Linking…' : 'Create Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactNetworkPanel;
