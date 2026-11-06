import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  FileText,
  Download,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle,
  DollarSign,
  X,
  Save
} from 'lucide-react';
import { contractService } from '../../services/contractService';
import { contractAuditService } from '../../services/contractAuditService';
import { invoiceService } from '../../services/invoiceService';
import { useCompanyContext } from '../../contexts/CompanyContext';
import { useToast } from '../ui/ToastProvider';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useActionProgress } from '../../contexts/ActionProgressContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import { generateContractPDF } from '../../utils/contractPDFGenerator';
import { CurrencyDisplay } from '../ui/CurrencyDisplay';
import ViewContractModal from './ViewContractModal';
import EditContractModal from './EditContractModal';
import StatusUpdateModal from './StatusUpdateModal';
import CreateContractModal from './CreateContractModal';
import ContractTemplateManagement from './ContractTemplateManagement';
import { getEntityPrefix } from '../../utils/customerCodeUtils';
import type { CompanySettings } from '../../types/invoice';
import type { 
  Contract, 
  ContractFilters, 
  ContractStatistics,
  ContractType,
  ContractStatus,
  ContractWithDetails,
  CreateContractData,
  CreateContractSectionData,
  ContractAuditLog
} from '../../types/contract';

const ContractManagement: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<ContractStatistics | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters] = useState<ContractFilters>({});
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contracts' | 'templates'>('dashboard');
  const { selectedCompany } = useCompanyContext();
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractWithDetails | null>(null);
  const [auditLogs, setAuditLogs] = useState<ContractAuditLog[]>([]);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [formData, setFormData] = useState<CreateContractData>({
    party_a_name: '',
    party_b_name: '',
    contract_type: 'MSA',
    contract_title: '',
    contract_date: new Date().toISOString().split('T')[0],
    effective_date: new Date().toISOString().split('T')[0],
    currency_code: 'INR',
    sections: []
  });
  
  const { showSuccess, showError, showInfo } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const { startAction, endAction } = useActionProgress();
  const perPage = 10;

  // Load initial data
  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm, filters, selectedCompany]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load company settings
      try {
        const companyData = await invoiceService.getCompanySettings();
        if (companyData && companyData.length > 0) {
          setCompanySettings(companyData[0]);
        }
      } catch (settingsError) {
        console.warn('Failed to load company settings:', settingsError);
      }

      // Load contracts
      const contractsData = await contractService.getContracts(
        { ...filters, search: searchTerm, company_settings_id: selectedCompany?.id },
        currentPage,
        perPage
      );
      
      setContracts(contractsData.contracts);
      setTotalPages(Math.ceil(contractsData.total / perPage));

      // Load statistics
      const targetCurrencyCode = selectedCompany?.country?.currency_code || (
        selectedCompany?.country_id === 'IE' || selectedCompany?.country?.code === 'IE' || selectedCompany?.country?.code === 'IRL' ? 'EUR' :
        selectedCompany?.country_id === 'US' || selectedCompany?.country?.code === 'US' || selectedCompany?.country?.code === 'USA' ? 'USD' :
        selectedCompany?.country_id === 'GB' || selectedCompany?.country_id === 'UK' || selectedCompany?.country?.code === 'GB' ? 'GBP' : 'INR'
      );
      const statsData = await contractService.getStatistics(selectedCompany?.id, targetCurrencyCode);
      setStats(statsData);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
      showError('Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  // Handle contract creation
  const handleCreateContract = () => {
    const company = selectedCompany || companySettings;
    if (!company) {
      showError('No company selected. Please select a company first.');
      return;
    }

    let fullAddress = '';
    if (company.address_line1) {
      fullAddress = company.address_line1;
      if (company.address_line2) {
        fullAddress += ', ' + company.address_line2;
      }
      if (company.city) {
        fullAddress += ', ' + company.city;
      }
      if (company.state) {
        fullAddress += ', ' + company.state;
      }
      if (company.postal_code) {
        fullAddress += ' - ' + company.postal_code;
      }
    }

    setFormData({
      company_settings_id: company.id || selectedCompany?.id,
      party_a_name: company.company_name || '',
      party_a_address: fullAddress,
      party_a_contact: company.phone || '',
      party_a_gstin: company.gstin || '',
      party_a_pan: company.pan || '',
      party_a_vat_number: company.vat_number || '',
      party_a_cro_number: company.cro_number || '',
      party_b_name: '',
      contract_type: 'MSA',
      contract_title: '',
      contract_date: new Date().toISOString().split('T')[0],
      effective_date: new Date().toISOString().split('T')[0],
      currency_code: selectedCompany?.country?.code === 'IE' || selectedCompany?.country?.code === 'IRL' || selectedCompany?.country_id === 'IE' || selectedCompany?.country_id === 'IRL' ? 'EUR' : 'INR',
      entity_prefix: getEntityPrefix(selectedCompany),
      sections: [
        {
          section_number: 1,
          section_title: 'Scope of Work',
          section_content: '',
          is_required: false,
          page_break_before: false
        }
      ]
    });
    setShowCreateModal(true);
  };

  // Handle save new contract
  const handleSaveNewContract = async (contractData: CreateContractData) => {
    try {
      const dataToSave = {
        ...contractData,
        company_settings_id: contractData.company_settings_id || selectedCompany?.id
      };
      const created = await contractService.createContract(dataToSave);
      await contractAuditService.log(created.id, 'create', 'contract', undefined, created.contract_number);
      showSuccess('Contract created successfully');
      setShowCreateModal(false);
      await loadData();
    } catch (err) {
      console.error('Error creating contract:', err);
      showError('Failed to create contract');
      throw err;
    }
  };

  // Handle contract view
  const handleViewContract = async (contractId: string) => {
    try {
      setLoading(true);
      const [contract, logs] = await Promise.all([
        contractService.getContractById(contractId),
        contractAuditService.getLogsForContract(contractId).catch(() => []),
      ]);
      if (contract) {
        setSelectedContract(contract);
        setAuditLogs(logs);
        setShowAuditPanel(false);
        setShowViewModal(true);
      } else {
        showError('Contract not found');
      }
    } catch (err) {
      console.error('Error loading contract:', err);
      showError('Failed to load contract details');
    } finally {
      setLoading(false);
    }
  };

  // Handle contract edit
  const handleEditContract = async (contractId: string) => {
    try {
      setLoading(true);
      const contract = await contractService.getContractById(contractId);
      if (contract) {
        setSelectedContract(contract);
        setShowEditModal(true);
      } else {
        showError('Contract not found');
      }
    } catch (err) {
      console.error('Error loading contract:', err);
      showError('Failed to load contract details');
    } finally {
      setLoading(false);
    }
  };

  // Handle save contract edits
  const handleSaveContract = async (updatedContract: any) => {
    try {
      setLoading(true);
      await contractService.updateContract(updatedContract);
      await contractAuditService.log(updatedContract.id, 'edit', 'contract', undefined, 'Contract updated');
      showSuccess('Contract updated successfully');
      setShowEditModal(false);
      setSelectedContract(null);
      await loadData();
    } catch (err) {
      console.error('Error updating contract:', err);
      showError('Failed to update contract');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (contractId: string) => {
    try {
      setLoading(true);
      const contract = await contractService.getContractById(contractId);
      if (contract) {
        setSelectedContract(contract);
        setShowStatusModal(true);
      } else {
        showError('Contract not found');
      }
    } catch (err) {
      console.error('Error loading contract:', err);
      showError('Failed to load contract details');
    } finally {
      setLoading(false);
    }
  };

  // Handle save status update
  const handleSaveStatus = async (newStatus: ContractStatus) => {
    if (!selectedContract) return;
    
    try {
      setLoading(true);
      await contractService.updateContractStatus(selectedContract.id, newStatus);
      showSuccess(`Contract status updated to ${newStatus}`);
      setShowStatusModal(false);
      setSelectedContract(null);
      await loadData();
    } catch (err) {
      console.error('Error updating status:', err);
      showError('Failed to update contract status');
      throw err; // Re-throw to keep modal open on error
    } finally {
      setLoading(false);
    }
  };

  // Handle contract delete
  const handleDeleteContract = async (contractId: string, contractNumber: string) => {
    const confirmed = await confirm({
      title: 'Delete Contract',
      message: `Are you sure you want to delete contract "${contractNumber}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      startAction('Deleting contract…');
      try {
        setLoading(true);
        await contractService.deleteContract(contractId);
        showSuccess('Contract deleted successfully');
        await loadData();
      } catch (err) {
        console.error('Error deleting contract:', err);
        showError('Failed to delete contract');
      } finally {
        setLoading(false);
        endAction();
      }
    }
  };

  // Handle contract PDF generation
  const handleGeneratePDF = async (contractId: string) => {
    try {
      showInfo('Generating contract PDF...');
      
      // Get full contract details with sections
      const fullContract = await contractService.getContractById(contractId);
      if (!fullContract) {
        showError('Contract not found');
        return;
      }

      const company = selectedCompany || companySettings;
      if (!company) {
        showError('Company settings not configured');
        return;
      }

      // Generate PDF using jsPDF
      const pdf = await generateContractPDF(fullContract, company);
      
      // Download the PDF
      const filename = `${fullContract.contract_number}_${fullContract.party_b_name.replace(/\s+/g, '_')}.pdf`;
      pdf.save(filename);
      showSuccess('Contract PDF generated successfully!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showError('Failed to generate contract PDF');
    }
  };

  // Get status badge color
  const getStatusBadge = (status: ContractStatus) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-teal-100 text-teal-800',
      rejected: 'bg-red-100 text-red-800',
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      terminated: 'bg-orange-100 text-orange-800',
      renewed: 'bg-blue-100 text-blue-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  // Get contract type badge
  const getContractTypeBadge = (type: ContractType) => {
    const badges = {
      MSA: 'bg-purple-100 text-purple-800',
      SOW: 'bg-blue-100 text-blue-800',
      NDA: 'bg-yellow-100 text-yellow-800',
      SLA: 'bg-green-100 text-green-800',
      WORK_ORDER: 'bg-indigo-100 text-indigo-800',
      MAINTENANCE: 'bg-teal-100 text-teal-800',
      CONSULTING: 'bg-pink-100 text-pink-800',
      LICENSE: 'bg-cyan-100 text-cyan-800',
      OTHER: 'bg-gray-100 text-gray-800'
    };
    return badges[type] || 'bg-gray-100 text-gray-800';
  };

  const entityCurrencyCode = selectedCompany?.country?.currency_code || (
    selectedCompany?.country_id === 'IE' || selectedCompany?.country?.code === 'IE' || selectedCompany?.country?.code === 'IRL' ? 'EUR' :
    selectedCompany?.country_id === 'US' || selectedCompany?.country?.code === 'US' || selectedCompany?.country?.code === 'USA' ? 'USD' :
    selectedCompany?.country_id === 'GB' || selectedCompany?.country_id === 'UK' || selectedCompany?.country?.code === 'GB' ? 'GBP' : 'INR'
  );

  // Format currency
  const formatCurrency = (amount: number | undefined, currencyCode: string = entityCurrencyCode) => {
    if (amount === undefined || amount === null) return '-';
    const locale = currencyCode === 'EUR' ? 'en-IE' : currencyCode === 'USD' ? 'en-US' : currencyCode === 'GBP' ? 'en-GB' : 'en-IN';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Render dashboard
  const renderDashboard = () => {
    if (!stats) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Contracts</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total_contracts}</p>
              </div>
              <FileText className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Contracts</p>
                <p className="text-2xl font-semibold text-green-600 mt-1">{stats.active_contracts}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expiring Soon</p>
                <p className="text-2xl font-semibold text-orange-600 mt-1">{stats.expiring_soon}</p>
                <p className="text-xs text-gray-500 mt-1">Next 30 days</p>
              </div>
              <AlertCircle className="w-12 h-12 text-orange-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-semibold text-blue-600 mt-1">
                  {formatCurrency(stats.total_contract_value, entityCurrencyCode)}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Recent Contracts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Contracts</h3>
          </div>
          {renderContractTable(
            [...contracts]
              .sort((a, b) => new Date(b.contract_date).getTime() - new Date(a.contract_date).getTime())
              .slice(0, 5)
          )}
        </div>
      </div>
    );
  };

  // Render contract table (reusable)
  const renderContractTable = (contractList: Contract[] = contracts) => (
    <div className="w-full">
      <table className="w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              Contract #
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title / Parties
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              Type
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              Status
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              Value
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              Dates
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading contracts...</span>
                </div>
              </td>
            </tr>
          ) : contractList.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                No contracts found.
              </td>
            </tr>
          ) : (
            contractList.map((contract) => (
              <tr key={contract.id} className="hover:bg-gray-50">
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{contract.contract_number}</div>
                  <div className="text-xs text-gray-500">{formatDate(contract.contract_date)}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-sm font-medium text-gray-900 truncate max-w-xs">{contract.contract_title}</div>
                  <div className="text-xs text-gray-500 truncate max-w-xs">
                    {contract.party_a_name} ↔ {contract.party_b_name}
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getContractTypeBadge(contract.contract_type)}`}>
                    {contract.contract_type}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(contract.status)}`}>
                    {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    <CurrencyDisplay 
                      amount={contract.contract_value || 0}
                      currencyCode={contract.currency_code || entityCurrencyCode}
                      targetCurrency={entityCurrencyCode}
                      showBothCurrencies={true}
                      conversionDate={contract.contract_date}
                    />
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="text-xs text-gray-500">
                    <div>Start: {formatDate(contract.effective_date)}</div>
                    <div>End: {formatDate(contract.expiry_date)}</div>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleViewContract(contract.id)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditContract(contract.id)}
                      className="text-green-600 hover:text-green-900"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(contract.id)}
                      className="text-purple-600 hover:text-purple-900"
                      title="Update Status"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleGeneratePDF(contract.id)}
                      className="text-purple-600 hover:text-purple-900"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteContract(contract.id, contract.contract_number)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // Render contracts list
  const renderContractsList = () => {
    return (
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search contracts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleCreateContract}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Contract
          </button>
        </div>

        {/* Contracts table */}
        <div className="bg-white rounded-lg shadow">
          {renderContractTable()}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main render
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-semibold text-gray-900">Contract Management</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('contracts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'contracts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Contracts
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Templates
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'contracts' && renderContractsList()}
        {activeTab === 'templates' && <ContractTemplateManagement />}
      </div>

      {/* Create Contract Modal */}
      {showCreateModal && (
        <CreateContractModal
          initialData={formData}
          onSave={handleSaveNewContract}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* View Contract Modal */}
      {showViewModal && selectedContract && (
        <ViewContractModal
          contract={selectedContract}
          onClose={() => {
            setShowViewModal(false);
            setSelectedContract(null);
            setAuditLogs([]);
          }}
        />
      )}

      {/* Audit Trail Panel — slides in over view modal */}
      {showViewModal && selectedContract && (
        <div className="fixed inset-y-0 right-0 z-[60] w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col"
          style={{ display: showAuditPanel ? 'flex' : 'none' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Audit Trail</h3>
              <p className="text-xs text-gray-500">{selectedContract.contract_number}</p>
            </div>
            <button onClick={() => setShowAuditPanel(false)} className="text-gray-400 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {auditLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No audit history yet.</div>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700 capitalize">{log.action.replace('_', ' ')}</span>
                    <span className="text-xs text-gray-400">{new Date(log.changed_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">By:</span> {log.user_email ?? log.user_id ?? 'Unknown user'}
                  </div>
                  {log.field_name && (
                    <div className="text-xs text-gray-600 mt-0.5">
                      <span className="font-medium">Field:</span> {log.field_name}
                    </div>
                  )}
                  {log.old_value && (
                    <div className="text-xs mt-1 bg-red-50 border border-red-100 rounded px-2 py-1">
                      <span className="text-red-600 font-medium">Before:</span> <span className="text-gray-700">{log.old_value}</span>
                    </div>
                  )}
                  {log.new_value && (
                    <div className="text-xs mt-1 bg-green-50 border border-green-100 rounded px-2 py-1">
                      <span className="text-green-600 font-medium">After:</span> <span className="text-gray-700">{log.new_value}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Audit trail toggle button — visible when view modal is open */}
      {showViewModal && selectedContract && (
        <button
          onClick={() => setShowAuditPanel(p => !p)}
          className="fixed bottom-6 right-6 z-[61] flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-full shadow-lg hover:bg-indigo-700"
        >
          <FileText className="w-4 h-4" />
          {showAuditPanel ? 'Hide Audit Trail' : 'View Audit Trail'}
          {auditLogs.length > 0 && (
            <span className="ml-1 bg-white text-indigo-600 text-xs font-bold rounded-full px-1.5">{auditLogs.length}</span>
          )}
        </button>
      )}

      {/* Edit Contract Modal */}
      {showEditModal && selectedContract && (
        <EditContractModal
          contract={selectedContract}
          onSave={handleSaveContract}
          onClose={() => {
            setShowEditModal(false);
            setSelectedContract(null);
          }}
        />
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedContract && (
        <StatusUpdateModal
          contractId={selectedContract.id}
          contractNumber={selectedContract.contract_number}
          currentStatus={selectedContract.status}
          onUpdate={handleSaveStatus}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedContract(null);
          }}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} loading={loading} />
    </div>
  );
};

export default ContractManagement;
