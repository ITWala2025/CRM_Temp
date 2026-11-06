import React, { useState, useEffect } from 'react';
import {
  X, Plus, Edit2, Trash2, CheckCircle2, Star, Mail, Phone,
  Briefcase, User, FileText, AlertCircle, RefreshCw, Archive, RotateCcw
} from 'lucide-react';
import { customerContactService } from '../../services/customerContactService';
import { useToast } from '../ui/ToastProvider';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useActionProgress } from '../../contexts/ActionProgressContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  CustomerContact,
  CreateCustomerContactData,
  CustomerContactRole,
  ROLE_LABELS,
  ROLE_BADGE_CLASSES
} from '../../types/customerContact';
import type { Customer } from '../../types/invoice';

interface CustomerContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onContactsUpdated?: () => void;
}

export const CustomerContactModal: React.FC<CustomerContactModalProps> = ({
  isOpen,
  onClose,
  customer,
  onContactsUpdated
}) => {
  const { showSuccess, showError } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const { startAction, endAction } = useActionProgress();

  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Add / Edit form state
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<CreateCustomerContactData>>({
    name: '',
    email: '',
    phone: '',
    job_title: '',
    role: 'secondary',
    is_primary: false,
    notes: ''
  });

  useEffect(() => {
    if (isOpen && customer) {
      loadContacts();
    }
  }, [isOpen, customer, showArchived]);

  const loadContacts = async () => {
    if (!customer?.id) return;
    try {
      setLoading(true);
      let list = await customerContactService.getCustomerContacts(customer.id, true);

      // If customer has no contacts in table yet, try auto-syncing legacy top-level fields
      if (list.length === 0 && (customer.contact_person || customer.email || customer.phone)) {
        await customerContactService.syncLegacyCustomerContact(customer);
        list = await customerContactService.getCustomerContacts(customer.id, true);
      }

      setContacts(list);
    } catch (err) {
      showError(`Failed to load contacts: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormMode('add');
    setEditingContactId(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      job_title: '',
      role: contacts.length === 0 ? 'primary' : 'secondary',
      is_primary: contacts.length === 0,
      notes: ''
    });
    setShowFormModal(true);
  };

  const openEditModal = (contact: CustomerContact) => {
    setFormMode('edit');
    setEditingContactId(contact.id);
    setFormData({
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      job_title: contact.job_title || '',
      role: contact.role,
      is_primary: contact.is_primary,
      notes: contact.notes || ''
    });
    setShowFormModal(true);
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    if (!formData.name?.trim()) {
      errors.push('Name is required');
    }
    if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.push('Valid email address is required');
    }
    if (formData.phone?.trim() && !/^[+]?[0-9\s\-()]{7,20}$/.test(formData.phone.trim())) {
      errors.push('Valid phone number is required');
    }
    return errors;
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.id) return;

    const errors = validateForm();
    if (errors.length > 0) {
      showError(`Please fix: ${errors.join(', ')}`);
      return;
    }

    try {
      setFormSubmitting(true);
      if (formMode === 'add') {
        await customerContactService.createCustomerContact(customer.id, {
          customer_id: customer.id,
          company_settings_id: customer.company_settings_id,
          name: formData.name!.trim(),
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          job_title: formData.job_title?.trim() || undefined,
          role: formData.role as CustomerContactRole,
          is_primary: formData.is_primary || false,
          notes: formData.notes?.trim() || undefined
        });
        showSuccess('Contact person added successfully!');
      } else if (formMode === 'edit' && editingContactId) {
        await customerContactService.updateCustomerContact(editingContactId, {
          name: formData.name!.trim(),
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          job_title: formData.job_title?.trim() || undefined,
          role: formData.role as CustomerContactRole,
          is_primary: formData.is_primary || false,
          notes: formData.notes?.trim() || undefined
        });
        showSuccess('Contact person updated successfully!');
      }

      setShowFormModal(false);
      await loadContacts();
      if (onContactsUpdated) onContactsUpdated();
    } catch (err) {
      showError(`Failed to save contact: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSetPrimary = async (contact: CustomerContact) => {
    if (!customer?.id || contact.is_primary) return;
    try {
      await customerContactService.setPrimaryContact(customer.id, contact.id);
      showSuccess(`${contact.name} is now designated as the Primary Contact.`);
      await loadContacts();
      if (onContactsUpdated) onContactsUpdated();
    } catch (err) {
      showError(`Failed to set primary contact: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleArchiveOrDelete = async (contact: CustomerContact, softDelete: boolean = true) => {
    const actionLabel = softDelete ? 'Archive (Soft-delete)' : 'Permanently Delete';
    const confirmed = await confirm({
      title: `${actionLabel} Contact`,
      message: `Are you sure you want to ${softDelete ? 'archive' : 'delete'} ${contact.name}? ${
        contact.is_primary ? 'This contact is currently the Primary Contact. Another contact will be promoted to Primary if available.' : ''
      }`,
      confirmText: softDelete ? 'Archive' : 'Delete',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    startAction(`${softDelete ? 'Archiving' : 'Deleting'} contact…`);
    try {
      await customerContactService.deleteCustomerContact(contact.id, softDelete);
      showSuccess(`Contact ${contact.name} ${softDelete ? 'archived' : 'deleted'} successfully.`);
      await loadContacts();
      if (onContactsUpdated) onContactsUpdated();
    } catch (err) {
      showError(`Failed to ${softDelete ? 'archive' : 'delete'} contact: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      endAction();
    }
  };

  const handleRestore = async (contact: CustomerContact) => {
    try {
      await customerContactService.updateCustomerContact(contact.id, { is_active: true });
      showSuccess(`Contact ${contact.name} restored to active status.`);
      await loadContacts();
      if (onContactsUpdated) onContactsUpdated();
    } catch (err) {
      showError(`Failed to restore contact: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (!isOpen || !customer) return null;

  const filteredContacts = contacts.filter(c => showArchived ? !c.is_active : c.is_active);
  const activeCount = contacts.filter(c => c.is_active).length;
  const archivedCount = contacts.filter(c => !c.is_active).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Customer Contacts: {customer.company_name || customer.contact_person || 'Customer'}
                {customer.customer_code && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 font-mono">
                    {customer.customer_code}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage multiple contact persons, designated roles (Primary, Billing, Sales), and job titles.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowArchived(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                !showArchived
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300'
              }`}
            >
              Active Contacts ({activeCount})
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                showArchived
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300'
              }`}
            >
              Archived ({archivedCount})
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadContacts}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              title="Refresh contacts"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add Contact Person</span>
            </button>
          </div>
        </div>

        {/* Contacts List Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
              <p className="text-sm">Loading contact persons...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <User className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {showArchived ? 'No archived contacts' : 'No contact persons added yet'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1">
                {showArchived
                  ? 'Archived contacts will be stored here.'
                  : 'Add contacts for Sales, Support, Billing, or Executive leads to keep your customer directory organized.'}
              </p>
              {!showArchived && (
                <button
                  onClick={openAddModal}
                  className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add First Contact</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  className={`relative p-4 rounded-xl border transition-all ${
                    contact.is_primary
                      ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 hover:border-gray-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                        {contact.name}
                      </h4>
                      {contact.is_primary && (
                        <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800">
                          <Star className="h-3 w-3 fill-purple-600 dark:fill-purple-300 text-purple-600" />
                          <span>Primary</span>
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                        ROLE_BADGE_CLASSES[contact.role] || ROLE_BADGE_CLASSES.secondary
                      }`}
                    >
                      {ROLE_LABELS[contact.role] || contact.role}
                    </span>
                  </div>

                  {/* Job Title */}
                  {contact.job_title && (
                    <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-2">
                      <Briefcase className="h-3.5 w-3.5 mr-1 text-gray-400" />
                      <span>{contact.job_title}</span>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                    {contact.email ? (
                      <div className="flex items-center truncate">
                        <Mail className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                        >
                          {contact.email}
                        </a>
                      </div>
                    ) : (
                      <div className="text-gray-400 italic text-[11px]">No email specified</div>
                    )}

                    {contact.phone ? (
                      <div className="flex items-center">
                        <Phone className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                        <a
                          href={`tel:${contact.phone}`}
                          className="hover:underline hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    ) : (
                      <div className="text-gray-400 italic text-[11px]">No phone specified</div>
                    )}
                  </div>

                  {/* Notes */}
                  {contact.notes && (
                    <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 p-2 rounded-lg border border-gray-100 dark:border-gray-800 line-clamp-2">
                      <FileText className="h-3 w-3 inline mr-1 text-gray-400" />
                      {contact.notes}
                    </div>
                  )}

                  {/* Card Actions Footer */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50 text-xs">
                    {!contact.is_primary && contact.is_active ? (
                      <button
                        onClick={() => handleSetPrimary(contact)}
                        className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium text-[11px] flex items-center space-x-1"
                      >
                        <Star className="h-3 w-3" />
                        <span>Set as Primary</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center space-x-2 ml-auto">
                      {contact.is_active ? (
                        <>
                          <button
                            onClick={() => openEditModal(contact)}
                            className="p-1 rounded text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            title="Edit Contact"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleArchiveOrDelete(contact, true)}
                            className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            title="Archive Contact"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRestore(contact)}
                            className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition flex items-center space-x-1 text-[11px] font-medium"
                            title="Restore Contact"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => handleArchiveOrDelete(contact, false)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            title="Permanently Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add / Edit Sub-modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {formMode === 'add' ? 'Add New Contact Person' : 'Edit Contact Person'}
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Designated Role
                  </label>
                  <select
                    value={formData.role || 'secondary'}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        role: e.target.value as CustomerContactRole,
                        is_primary: e.target.value === 'primary' ? true : prev.is_primary
                      }))
                    }
                    className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formData.job_title || ''}
                    onChange={e => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                    placeholder="e.g. Finance Manager"
                    className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@company.com"
                    className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 555-0199"
                    className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Notes / Internal Comments
                </label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Direct extension, billing queries, availability, etc."
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="is_primary_checkbox"
                  checked={formData.is_primary || formData.role === 'primary'}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      is_primary: e.target.checked,
                      role: e.target.checked ? 'primary' : prev.role === 'primary' ? 'secondary' : prev.role
                    }))
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="is_primary_checkbox" className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  Set as Primary Contact for this customer organization
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center space-x-1 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow transition disabled:opacity-50"
                >
                  {formSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{formMode === 'add' ? 'Save Contact' : 'Update Contact'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};
