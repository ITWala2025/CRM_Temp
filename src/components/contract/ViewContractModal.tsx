import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, DollarSign, Users, CheckCircle, XCircle } from 'lucide-react';
import DOMPurify from 'dompurify';
import { exchangeRateService } from '../../services/exchangeRateService';
import { useCompanyContext } from '../../contexts/CompanyContext';
import type { ContractWithDetails } from '../../types/contract';

interface ViewContractModalProps {
  contract: ContractWithDetails;
  onClose: () => void;
}

const ViewContractModal: React.FC<ViewContractModalProps> = ({ contract, onClose }) => {
  const { selectedCompany } = useCompanyContext();
  const [convertedValue, setConvertedValue] = useState<number | null>(null);
  const [convertedMilestones, setConvertedMilestones] = useState<Record<string, number>>({});

  const targetCurrency = selectedCompany?.country?.currency_code || (
    selectedCompany?.country_id === 'IE' || selectedCompany?.country?.code === 'IE' || selectedCompany?.country?.code === 'IRL' ? 'EUR' :
    selectedCompany?.country_id === 'US' || selectedCompany?.country?.code === 'US' || selectedCompany?.country?.code === 'USA' ? 'USD' :
    selectedCompany?.country_id === 'GB' || selectedCompany?.country_id === 'UK' || selectedCompany?.country?.code === 'GB' ? 'GBP' : 'INR'
  );

  useEffect(() => {
    // Convert contract value using exchangeRateService for target currency
    const convertValues = async () => {
      const contractCurr = contract.currency_code || 'INR';
      if (contract.contract_value && contractCurr !== targetCurrency) {
        try {
          const res = await exchangeRateService.convertCurrency(contract.contract_value, contractCurr, targetCurrency);
          if (res && typeof res.converted_amount === 'number') {
            setConvertedValue(res.converted_amount);
          }
        } catch (e) {
          console.warn(`Failed to convert contract value (${contractCurr} -> ${targetCurrency}):`, e);
        }
      }

      // Convert milestone amounts
      if (contract.milestones && contract.milestones.length > 0 && contractCurr !== targetCurrency) {
        const converted: Record<string, number> = {};
        for (const milestone of contract.milestones) {
          if (milestone.payment_amount) {
            try {
              const res = await exchangeRateService.convertCurrency(milestone.payment_amount, contractCurr, targetCurrency);
              if (res && typeof res.converted_amount === 'number') {
                converted[milestone.id] = res.converted_amount;
              }
            } catch (e) {
              console.warn(`Failed to convert milestone amount (${contractCurr} -> ${targetCurrency}):`, e);
            }
          }
        }
        setConvertedMilestones(converted);
      }
    };

    convertValues();
  }, [contract, targetCurrency]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN');
  };

  const formatCurrency = (amount?: number, currencyCode: string = 'INR') => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-teal-100 text-teal-800',
      rejected: 'bg-red-100 text-red-800',
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      terminated: 'bg-red-100 text-red-800',
      renewed: 'bg-blue-100 text-blue-800'
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getContractTypeBadge = (type: string) => {
    const badges = {
      MSA: 'bg-blue-100 text-blue-800',
      SOW: 'bg-purple-100 text-purple-800',
      NDA: 'bg-yellow-100 text-yellow-800',
      SLA: 'bg-green-100 text-green-800',
      WORK_ORDER: 'bg-orange-100 text-orange-800',
      MAINTENANCE: 'bg-pink-100 text-pink-800',
      CONSULTING: 'bg-indigo-100 text-indigo-800',
      LICENSE: 'bg-teal-100 text-teal-800',
      OTHER: 'bg-gray-100 text-gray-800'
    };
    return badges[type as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">Contract Details</h2>
              <p className="text-blue-100 text-sm">{contract.contract_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-full p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Contract Title</label>
                <p className="text-gray-900 font-medium">{contract.contract_title}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Contract Type</label>
                <div className="mt-1">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getContractTypeBadge(contract.contract_type)}`}>
                    {contract.contract_type}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusBadge(contract.status)}`}>
                    {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Contract Value</label>
                <p className="text-gray-900 font-medium">
                  <span className="text-lg font-semibold">
                    {formatCurrency(contract.contract_value, contract.currency_code)}
                  </span>
                  {convertedValue && contract.currency_code !== targetCurrency && (
                    <span className="text-sm text-gray-600 block mt-1">
                      ≈ {formatCurrency(convertedValue, targetCurrency)}
                      <span className="text-xs text-gray-500 ml-1">(live rate)</span>
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              Contract Parties
            </h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Party A */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">Party A (First Party)</h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Name</label>
                    <p className="text-sm text-gray-900">{contract.party_a_name}</p>
                  </div>
                  {contract.party_a_address && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Address</label>
                      <p className="text-sm text-gray-900">{contract.party_a_address}</p>
                    </div>
                  )}
                  {contract.party_a_contact && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Contact</label>
                      <p className="text-sm text-gray-900">{contract.party_a_contact}</p>
                    </div>
                  )}
                  {contract.party_a_gstin && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">GSTIN</label>
                      <p className="text-sm text-gray-900">{contract.party_a_gstin}</p>
                    </div>
                  )}
                  {contract.party_a_vat_number && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">VAT Number</label>
                      <p className="text-sm text-gray-900">{contract.party_a_vat_number}</p>
                    </div>
                  )}
                  {contract.party_a_cro_number && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">CRO Number</label>
                      <p className="text-sm text-gray-900">{contract.party_a_cro_number}</p>
                    </div>
                  )}
                  {contract.party_a_pan && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">PAN</label>
                      <p className="text-sm text-gray-900">{contract.party_a_pan}</p>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center">
                      {contract.signed_by_party_a ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                          <span className="text-sm text-green-600 font-medium">Signed</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-500">Not Signed</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Party B */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">Party B (Second Party)</h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Name</label>
                    <p className="text-sm text-gray-900">{contract.party_b_name}</p>
                  </div>
                  {contract.party_b_address && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Address</label>
                      <p className="text-sm text-gray-900">{contract.party_b_address}</p>
                    </div>
                  )}
                  {contract.party_b_contact && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Contact</label>
                      <p className="text-sm text-gray-900">{contract.party_b_contact}</p>
                    </div>
                  )}
                  {contract.party_b_gstin && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">GSTIN</label>
                      <p className="text-sm text-gray-900">{contract.party_b_gstin}</p>
                    </div>
                  )}
                  {contract.party_b_vat_number && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">VAT Number</label>
                      <p className="text-sm text-gray-900">{contract.party_b_vat_number}</p>
                    </div>
                  )}
                  {contract.party_b_cro_number && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">CRO Number</label>
                      <p className="text-sm text-gray-900">{contract.party_b_cro_number}</p>
                    </div>
                  )}
                  {contract.party_b_pan && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">PAN</label>
                      <p className="text-sm text-gray-900">{contract.party_b_pan}</p>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center">
                      {contract.signed_by_party_b ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                          <span className="text-sm text-green-600 font-medium">Signed</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-500">Not Signed</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-600" />
              Important Dates
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Contract Date</label>
                <p className="text-gray-900">{formatDate(contract.contract_date)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Effective Date</label>
                <p className="text-gray-900">{formatDate(contract.effective_date)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Expiry Date</label>
                <p className="text-gray-900">{formatDate(contract.expiry_date)}</p>
              </div>
              {contract.signed_date && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Signed Date</label>
                  <p className="text-gray-900">{formatDate(contract.signed_date)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financial Details */}
          {(contract.contract_value || contract.payment_terms) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
                Financial Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {contract.contract_value && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Contract Value</label>
                    <p className="text-gray-900 font-semibold text-lg">
                      <span className="block">
                        {formatCurrency(contract.contract_value, contract.currency_code)}
                      </span>
                      {convertedValue && contract.currency_code !== targetCurrency && (
                        <span className="text-sm text-gray-600 font-normal block mt-1">
                          ≈ {formatCurrency(convertedValue, targetCurrency)}
                          <span className="text-xs text-gray-500 ml-1">(live rate)</span>
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {contract.payment_terms && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Payment Terms</label>
                    <p className="text-gray-900">{contract.payment_terms}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preamble */}
          {contract.preamble && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preamble</h3>
              <div 
                className="text-sm text-gray-700 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contract.preamble) }}
              />
            </div>
          )}

          {/* Contract Sections */}
          {contract.sections && contract.sections.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Sections</h3>
              <div className="space-y-4">
                {contract.sections.map((section) => (
                  <div key={section.id} className="bg-white rounded-lg p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      {section.section_number}. {section.section_title}
                    </h4>
                    <div 
                      className="text-sm text-gray-700 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.section_content) }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones (if any) */}
          {contract.milestones && contract.milestones.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Milestones</h3>
              <div className="space-y-3">
                {contract.milestones.map((milestone) => (
                  <div key={milestone.id} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">
                        Milestone {milestone.milestone_number}: {milestone.milestone_title}
                      </h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        milestone.status === 'completed' ? 'bg-green-100 text-green-800' :
                        milestone.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        milestone.status === 'delayed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {milestone.status.replace('_', ' ')}
                      </span>
                    </div>
                    {milestone.description && (
                      <p className="text-sm text-gray-700 mb-2">{milestone.description}</p>
                    )}
                    {milestone.deliverables && (
                      <div className="mb-2">
                        <label className="text-xs font-medium text-gray-500">Deliverables:</label>
                        <p className="text-sm text-gray-700">{milestone.deliverables}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        {milestone.due_date && (
                          <span className="text-gray-500">Due: {formatDate(milestone.due_date)}</span>
                        )}
                        {milestone.completion_date && (
                          <span className="text-gray-500 ml-4">Completed: {formatDate(milestone.completion_date)}</span>
                        )}
                      </div>
                      {milestone.payment_amount && (
                        <div className="font-semibold text-gray-900">
                          <span>{formatCurrency(milestone.payment_amount, contract.currency_code)}</span>
                          {convertedMilestones[milestone.id] && contract.currency_code !== targetCurrency && (
                            <span className="text-xs text-gray-600 font-normal block">
                              ≈ {formatCurrency(convertedMilestones[milestone.id], targetCurrency)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {contract.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{contract.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Metadata</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs text-gray-500">Created At</label>
                <p className="text-gray-700">{formatDate(contract.created_at)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Last Updated</label>
                <p className="text-gray-700">{formatDate(contract.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewContractModal;
