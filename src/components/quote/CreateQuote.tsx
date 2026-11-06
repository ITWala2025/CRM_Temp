import React, { useState } from 'react';
import { FileText, Package, Plus, Trash, X, Eye, Save, Briefcase, Phone, Clock, Percent, DollarSign, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import type { CreateQuoteData, CreateQuoteItemData, Customer, Product } from '../../types/quote';
import type { TermsTemplate, CompanySettings } from '../../types/invoice';
import type { RateCardTemplate } from '../../types/rateCard';
import { getTaxLabel, getClassificationCodeLabel } from '../../utils/taxUtils';
import { formatCustomerOption } from '../../utils/customerCodeUtils';
import { ExchangeRateDisplay } from '../ui/ExchangeRateDisplay';
import { rateCardService } from '../../services/rateCardService';
import { analyzeSalaryToRate, calculateTotalRate } from '../../types/rateCard';

interface CreateQuoteProps {
  quoteFormData: CreateQuoteData;
  onFormChange: (field: keyof CreateQuoteData, value: string | CreateQuoteItemData[]) => void;
  onItemChange: (index: number, field: keyof CreateQuoteItemData, value: string | number | boolean | undefined) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onSaveQuote: () => void;
  onCloseQuote: () => void;
  onShowPreview: () => void;
  onTermsChange: (termsContent: string) => void;
  onTermsTemplateSelect: (templateId: string) => void;
  onDefaultProductChange: (productId: string) => void;
  customers: Customer[];
  products: Product[];
  termsTemplates: TermsTemplate[];
  companySettings: CompanySettings[];
  selectedDefaultProduct: string;
  selectedTermsTemplateId: string;
  globalHsnCode: string;
  generatedQuoteNumber: string;
  modalLoading?: boolean;
  calculateQuoteTotals: () => { subtotal: number; discountAmount: number; taxAmount: number; total: number };
  getCurrencyInfo: (customer: Customer | undefined) => { symbol: string; code: string; name: string };
  formatCurrencyAmount: (amount: number, currencyInfo: { symbol: string; code: string }) => string;
  formatAmountInWords: (amount: number, currencyName: string) => string;
}

export const CreateQuote: React.FC<CreateQuoteProps> = ({
  quoteFormData,
  onFormChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSaveQuote,
  onCloseQuote,
  onShowPreview,
  onTermsChange,
  onTermsTemplateSelect,
  onDefaultProductChange,
  customers,
  products,
  termsTemplates,
  companySettings,
  selectedDefaultProduct,
  selectedTermsTemplateId,
  globalHsnCode,
  generatedQuoteNumber,
  modalLoading = false,
  calculateQuoteTotals,
  getCurrencyInfo,
  formatCurrencyAmount,
  formatAmountInWords
}) => {
  const { subtotal, discountAmount, taxAmount, total } = calculateQuoteTotals();
  const selectedCustomer = customers.find(c => c.id === quoteFormData.customer_id);
  const currencyInfo = getCurrencyInfo(selectedCustomer);
  const activeProducts = products.filter(p => p.is_active);

  // Get dynamic tax label based on customer's country
  const taxLabel = getTaxLabel(selectedCustomer);
  const classificationLabel = getClassificationCodeLabel(selectedCustomer);

  // Rate Card Reference State
  const [showRateCardReference, setShowRateCardReference] = useState(false);
  const [rateCardTemplates, setRateCardTemplates] = useState<RateCardTemplate[]>([]);
  const [loadingRateCards, setLoadingRateCards] = useState(false);
  const [selectedRateCardFilter, setSelectedRateCardFilter] = useState<'all' | 'Full Stack Custom' | 'AI/ML' | 'Non Technical Roles'>('all');

  // Load rate card templates when reference panel is opened
  const loadRateCardTemplates = async () => {
    setLoadingRateCards(true);
    try {
      const templates = await rateCardService.getRateCardTemplates({
        is_active: true,
        ...(selectedRateCardFilter !== 'all' && { category: selectedRateCardFilter })
      });
      setRateCardTemplates(templates);
    } catch (error) {
      console.error('Failed to load rate card templates:', error);
    } finally {
      setLoadingRateCards(false);
    }
  };

  // Load rate cards when panel is opened or filter changes
  React.useEffect(() => {
    if (showRateCardReference) {
      loadRateCardTemplates();
    }
  }, [showRateCardReference, selectedRateCardFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Create New Quotation</h1>
              <p className="text-slate-600 mt-1">Generate professional quotations for potential clients</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onCloseQuote}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg shadow-sm text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={onShowPreview}
                className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                <Eye className="w-4 h-4 mr-2" />
                Show Preview
              </button>
              <button
                onClick={onSaveQuote}
                disabled={modalLoading || !quoteFormData.customer_id || !quoteFormData.items[0]?.item_name || !quoteFormData.items[0]?.description}
                className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {modalLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Quotation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quote Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center mb-6">
                <FileText className="w-5 h-5 text-emerald-600 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">Quotation Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Quote Number
                  </label>
                  <input
                    type="text"
                    value={generatedQuoteNumber || "Generating..."}
                    disabled
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">Quote number will be generated automatically</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer *
                  </label>
                  <select
                    value={quoteFormData.customer_id}
                    onChange={(e) => onFormChange('customer_id', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.filter(customer => customer.is_active !== false).map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {formatCustomerOption(customer, companySettings)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Quote Date *
                  </label>
                  <input
                    type="date"
                    value={quoteFormData.quote_date}
                    onChange={(e) => onFormChange('quote_date', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={quoteFormData.valid_until}
                    onChange={(e) => onFormChange('valid_until', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Product Selection */}
              {activeProducts.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Product/Service
                  </label>
                  <select
                    value={selectedDefaultProduct}
                    onChange={(e) => onDefaultProductChange(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  >
                    <option value="">Choose a product to add quickly</option>
                    {activeProducts.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Select to auto-fill item details</p>
                </div>
              )}
            </div>

            {/* Project Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center mb-6">
                <Briefcase className="w-5 h-5 text-emerald-600 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">Project Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Website Redesign, Mobile App Development"
                    value={quoteFormData.project_title || ''}
                    onChange={(e) => onFormChange('project_title', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Estimated Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 2-3 weeks, 1 month, 45 days"
                    value={quoteFormData.estimated_time || ''}
                    onChange={(e) => onFormChange('estimated_time', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Company Contact Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center mb-6">
                <Phone className="w-5 h-5 text-emerald-600 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">Company Contact Details</h3>
                <span className="ml-2 text-xs text-slate-500">(Your contact person for this quote)</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., John Doe"
                    value={quoteFormData.company_contact_name || ''}
                    onChange={(e) => onFormChange('company_contact_name', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g., john@company.com"
                    value={quoteFormData.company_contact_email || ''}
                    onChange={(e) => onFormChange('company_contact_email', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g., +91 98765 43210"
                    value={quoteFormData.company_contact_phone || ''}
                    onChange={(e) => onFormChange('company_contact_phone', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Discount Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center mb-6">
                <Percent className="w-5 h-5 text-emerald-600 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">Discount</h3>
                <span className="ml-2 text-xs text-slate-500">(Optional)</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Discount Type
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="discount_type"
                        value=""
                        checked={!quoteFormData.discount_type}
                        onChange={() => {
                          onFormChange('discount_type', '');
                          onFormChange('discount_value', '0');
                        }}
                        className="mr-2 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-700">None</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="discount_type"
                        value="percentage"
                        checked={quoteFormData.discount_type === 'percentage'}
                        onChange={() => onFormChange('discount_type', 'percentage')}
                        className="mr-2 text-emerald-600 focus:ring-emerald-500"
                      />
                      <Percent className="w-4 h-4 mr-1 text-slate-500" />
                      <span className="text-sm text-slate-700">Percentage</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="discount_type"
                        value="fixed"
                        checked={quoteFormData.discount_type === 'fixed'}
                        onChange={() => onFormChange('discount_type', 'fixed')}
                        className="mr-2 text-emerald-600 focus:ring-emerald-500"
                      />
                      <DollarSign className="w-4 h-4 mr-1 text-slate-500" />
                      <span className="text-sm text-slate-700">Fixed Amount</span>
                    </label>
                  </div>
                </div>
                
                {quoteFormData.discount_type && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Discount {quoteFormData.discount_type === 'percentage' ? '(%)' : `(${currencyInfo.symbol})`}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={quoteFormData.discount_type === 'percentage' ? 100 : undefined}
                      placeholder={quoteFormData.discount_type === 'percentage' ? 'e.g., 10' : 'e.g., 500'}
                      value={quoteFormData.discount_value || ''}
                      onChange={(e) => onFormChange('discount_value', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                    {quoteFormData.discount_type === 'percentage' && quoteFormData.discount_value && subtotal > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Discount: {formatCurrencyAmount((subtotal * Number(quoteFormData.discount_value)) / 100, currencyInfo)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Rate Card Reference (Optional) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <button
                onClick={() => setShowRateCardReference(!showRateCardReference)}
                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center">
                  <Calculator className="w-5 h-5 text-blue-600 mr-2" />
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-slate-900">Rate Card Reference</h3>
                    <p className="text-sm text-slate-600 mt-0.5">Optional: View standard rates to help with pricing</p>
                  </div>
                </div>
                {showRateCardReference ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {showRateCardReference && (
                <div className="px-6 pb-6 border-t border-slate-200">
                  {/* Filter by Category */}
                  <div className="mt-4 mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Filter by Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['all', 'Full Stack Custom', 'AI/ML', 'Non Technical Roles'].map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedRateCardFilter(category as any)}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            selectedRateCardFilter === category
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {category === 'all' ? 'All Categories' : category}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rate Card Templates */}
                  {loadingRateCards ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-slate-600 mt-2">Loading rate cards...</p>
                    </div>
                  ) : rateCardTemplates.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Calculator className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">No rate card templates found</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rateCardTemplates.map((template) => {
                        const analysis = analyzeSalaryToRate(template);
                        // Calculate total rate including all cost heads
                        const totalRateCalc = calculateTotalRate(
                          template.base_rate_usd,
                          template.base_rate_inr,
                          template.cost_heads
                        );

                        return (
                          <div
                            key={template.id}
                            className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-slate-900">{template.template_name}</h4>
                                <p className="text-xs text-slate-600">
                                  {template.category} • {template.resource_level}
                                </p>
                              </div>
                              {analysis && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                  {analysis.markup_percentage.toFixed(0)}% markup
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 mt-3">
                              {/* Total Hourly Rate - Highlighted */}
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md p-2 mb-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold text-slate-700">Total Hourly Rate:</span>
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-blue-600">
                                      ${totalRateCalc.total_rate_usd.toFixed(2)}/hr
                                    </div>
                                    <div className="text-xs text-slate-600">
                                      ₹{totalRateCalc.total_rate_inr.toFixed(2)}/hr
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-blue-600 mt-1">
                                  ℹ️ Includes all cost heads
                                </div>
                              </div>

                              {/* Base Rate */}
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-600">Base Rate:</span>
                                <span className="font-medium text-slate-700">
                                  ${template.base_rate_usd.toFixed(2)}/hr
                                </span>
                              </div>

                              {/* Cost Heads Breakdown */}
                              {template.cost_heads && template.cost_heads.length > 0 && (
                                <div className="pt-2 border-t border-slate-200">
                                  <p className="text-xs font-medium text-slate-700 mb-1">Cost Breakdown:</p>
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {template.cost_heads.map((head, idx) => (
                                      <div key={idx} className="flex justify-between text-xs">
                                        <span className="text-slate-600">{head.name}:</span>
                                        <span className="text-slate-700">
                                          ${head.value.toFixed(2)}
                                          {head.percentage ? ` (${head.percentage}%)` : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-1 pt-1 border-t border-slate-300 flex justify-between text-xs font-semibold">
                                    <span className="text-slate-700">Total Cost Heads:</span>
                                    <span className="text-blue-600">
                                      ${totalRateCalc.total_cost_heads_usd.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Monthly Revenue Projection */}
                              {analysis && (
                                <div className="pt-2 border-t border-slate-200">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-600">Monthly Revenue (160h):</span>
                                    <span className="font-semibold text-green-600">
                                      ${analysis.potential_monthly_revenue_usd.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Description */}
                              {template.description && (
                                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                  {template.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <strong>Note:</strong> These are reference rates only. You can manually enter your desired rates in the line items below.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Line Items Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Package className="w-5 h-5 text-emerald-600 mr-2" />
                  <h3 className="text-lg font-semibold text-slate-900">Line Items</h3>
                </div>
                <button
                  onClick={onAddItem}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {quoteFormData.items.map((item, index) => {
                  // Calculate line total based on item type
                  let lineSubtotal = 0;
                  if (item.is_service_item && item.billable_hours) {
                    const resourceCount = item.resource_count || 1;
                    lineSubtotal = resourceCount * item.quantity * item.billable_hours * item.unit_price;
                  } else {
                    lineSubtotal = item.quantity * item.unit_price;
                  }
                  const lineTaxAmount = (lineSubtotal * item.tax_rate) / 100;
                  const lineTotal = lineSubtotal + lineTaxAmount;

                  return (
                    <div key={index} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                      {/* Service Item Toggle */}
                      <div className="mb-3 flex items-center">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.is_service_item || false}
                            onChange={(e) => {
                              onItemChange(index, 'is_service_item', e.target.checked);
                              // Initialize service fields when toggling
                              if (e.target.checked) {
                                onItemChange(index, 'unit', 'months');
                                // Initialize resource_count if not set
                                if (!item.resource_count) {
                                  onItemChange(index, 'resource_count', 1);
                                }
                                // Initialize billable_hours if not set
                                if (!item.billable_hours) {
                                  onItemChange(index, 'billable_hours', 160);
                                }
                              } else {
                                onItemChange(index, 'unit', 'pcs');
                                onItemChange(index, 'billable_hours', undefined);
                                onItemChange(index, 'resource_count', undefined);
                              }
                            }}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                          />
                          <span className="text-sm font-medium text-slate-700">
                            Service-based Item (Consulting/Training)
                          </span>
                        </label>
                      </div>

                      {/* Service Items: Split into 2 rows for better alignment */}
                      {item.is_service_item ? (
                        <div className="space-y-4">
                          {/* Row 1: Item Name and Resources/Personnel */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Item Name */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">
                                Item Name *
                              </label>
                              <input
                                type="text"
                                placeholder="e.g., IT Consulting Services"
                                value={item.item_name}
                                onChange={(e) => onItemChange(index, 'item_name', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                                required
                              />
                            </div>

                            {/* Resource Count */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">
                                Resources/Personnel
                              </label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="e.g., 5"
                                value={item.resource_count || 1}
                                onChange={(e) => onItemChange(index, 'resource_count', parseFloat(e.target.value) || 1)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                              />
                            </div>
                          </div>

                          {/* Row 2: Duration, Hours/Month, and Rate */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {/* Duration (Months) */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">
                                Duration (Months)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="e.g., 6"
                                value={item.quantity}
                                onChange={(e) => onItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                              />
                            </div>

                            {/* Billable Hours */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">
                                Hours/Month
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="e.g., 160"
                                value={item.billable_hours || ''}
                                onChange={(e) => onItemChange(index, 'billable_hours', parseFloat(e.target.value) || undefined)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                              />
                            </div>

                            {/* Hourly Rate */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">
                                Rate ({currencyInfo.symbol}/hr)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Hourly rate"
                                value={item.unit_price}
                                onChange={(e) => onItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Regular Items: 3 fields */
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          {/* Item Name - spans 2 columns */}
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Item Name *
                            </label>
                            <input
                              type="text"
                              placeholder="Enter item name"
                              value={item.item_name}
                              onChange={(e) => onItemChange(index, 'item_name', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                              required
                            />
                          </div>

                          {/* Quantity */}
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="e.g., 10"
                              value={item.quantity}
                              onChange={(e) => onItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                            />
                          </div>

                          {/* Unit */}
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Unit
                            </label>
                            <input
                              type="text"
                              placeholder="pcs"
                              value={item.unit}
                              onChange={(e) => onItemChange(index, 'unit', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {/* Rate field for regular items - separate row for better alignment */}
                      {!item.is_service_item && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="sm:col-span-2">
                            {/* Empty space for alignment */}
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Rate ({currencyInfo.symbol})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Unit price"
                              value={item.unit_price}
                              onChange={(e) => onItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Description and HSN Code */}
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Description *
                            <span className="font-normal text-xs text-slate-500 ml-2">(Use • or - for bullet points)</span>
                          </label>
                          <textarea
                            placeholder={`Enter item description\n• Feature 1\n• Feature 2\n• Feature 3`}
                            value={item.description}
                            onChange={(e) => onItemChange(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm font-mono"
                            rows={4}
                            required
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            💡 Tip: Start lines with • or - for bullet points in the preview/PDF
                          </p>
                        </div>
                        
                        {/* Classification Code */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {classificationLabel}
                          </label>
                          <input
                            type="text"
                            value={globalHsnCode || item.hsn_code || ''}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
                            placeholder={classificationLabel}
                            readOnly
                          />
                        </div>
                      </div>
                      
                      {/* Tax Rate and Total */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              {taxLabel} (%)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.tax_rate}
                              onChange={(e) => onItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                              className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                            />
                          </div>
                          {quoteFormData.items.length > 1 && (
                            <button
                              onClick={() => onRemoveItem(index)}
                              className="mt-6 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove item"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-600">
                              {item.quantity} × {formatCurrencyAmount(item.unit_price, currencyInfo)} = {formatCurrencyAmount(lineSubtotal, currencyInfo)}
                            </div>
                            <div className="text-xs text-slate-600">
                              {taxLabel} ({item.tax_rate}%): {formatCurrencyAmount(lineTaxAmount, currencyInfo)}
                            </div>
                            <div className="text-sm font-medium text-slate-700 border-t border-slate-300 pt-1">
                              Total: <span className="text-lg font-semibold text-slate-900">{formatCurrencyAmount(lineTotal, currencyInfo)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={quoteFormData.notes}
                onChange={(e) => onFormChange('notes', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-sm"
                placeholder="Any additional notes for the customer..."
              />
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quotation Summary</h3>
              
              {/* Project Title */}
              {quoteFormData.project_title && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <h4 className="font-medium text-emerald-800 text-sm">Project</h4>
                  <p className="text-emerald-700 font-semibold">{quoteFormData.project_title}</p>
                  {quoteFormData.estimated_time && (
                    <p className="text-xs text-emerald-600 mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Est. Time: {quoteFormData.estimated_time}
                    </p>
                  )}
                </div>
              )}
              
              {selectedCustomer && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium text-slate-900 mb-2">Quote For:</h4>
                  <p className="text-sm text-slate-600">
                    {selectedCustomer.company_name || selectedCustomer.contact_person}
                  </p>
                  {selectedCustomer.email && (
                    <p className="text-sm text-slate-600">{selectedCustomer.email}</p>
                  )}
                  {selectedCustomer.city && selectedCustomer.state && (
                    <p className="text-sm text-slate-600">
                      {selectedCustomer.city}, {selectedCustomer.state}
                    </p>
                  )}
                </div>
              )}

              {/* Company Contact */}
              {(quoteFormData.company_contact_name || quoteFormData.company_contact_email || quoteFormData.company_contact_phone) && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Your Contact:</h4>
                  {quoteFormData.company_contact_name && (
                    <p className="text-sm text-blue-700">{quoteFormData.company_contact_name}</p>
                  )}
                  {quoteFormData.company_contact_email && (
                    <p className="text-sm text-blue-700">{quoteFormData.company_contact_email}</p>
                  )}
                  {quoteFormData.company_contact_phone && (
                    <p className="text-sm text-blue-700">{quoteFormData.company_contact_phone}</p>
                  )}
                </div>
              )}
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrencyAmount(subtotal, currencyInfo)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Discount {quoteFormData.discount_type === 'percentage' ? `(${quoteFormData.discount_value}%)` : ''}:</span>
                    <span className="font-medium">-{formatCurrencyAmount(discountAmount, currencyInfo)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{taxLabel}:</span>
                  <span className="font-medium">{formatCurrencyAmount(taxAmount, currencyInfo)}</span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-slate-900">Total:</span>
                    <span className="text-emerald-600">{formatCurrencyAmount(total, currencyInfo)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 italic">
                    {formatAmountInWords(total, currencyInfo.name)}
                  </p>
                </div>
              </div>

              {/* Validity Notice */}
              {quoteFormData.valid_until && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    <strong>Quote Valid Until:</strong> {new Date(quoteFormData.valid_until).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Exchange Rate Display for Non-INR Customers */}
            <ExchangeRateDisplay selectedCustomer={selectedCustomer} />
          </div>
        </div>
      </div>
    </div>
  );
};
