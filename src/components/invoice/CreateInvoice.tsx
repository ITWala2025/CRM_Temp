import React from 'react';
import { FileText, Package, Plus, Trash, X, Eye, Save, RefreshCw } from 'lucide-react';
import type { CreateInvoiceData, CreateInvoiceItemData, Customer, Product, TermsTemplate, CompanySettings } from '../../types/invoice';
import { getTaxLabel, getClassificationCodeLabel } from '../../utils/taxUtils';
import { formatCustomerOption } from '../../utils/customerCodeUtils';


interface CreateInvoiceProps {
  invoiceFormData: CreateInvoiceData;
  onFormChange: (field: keyof CreateInvoiceData, value: string | CreateInvoiceItemData[]) => void;
  onItemChange: (index: number, field: keyof CreateInvoiceItemData, value: string | number | boolean | undefined) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onSaveInvoice: () => void;
  onCloseInvoice: () => void;
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
  generatedInvoiceNumber: string;
  modalLoading?: boolean;
  calculateInvoiceTotals: () => { subtotal: number; discountAmount: number; taxAmount: number; total: number };
  getCurrencyInfo: (customer: Customer | undefined) => { symbol: string; code: string; name: string };
  formatCurrencyAmount: (amount: number, currencyInfo: { symbol: string; code: string }) => string;
  formatAmountInWords: (amount: number, currencyName: string) => string;
  useINROverride?: boolean;
  onCurrencyToggle?: () => void;
}

export const CreateInvoice: React.FC<CreateInvoiceProps> = ({
  invoiceFormData,
  onFormChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSaveInvoice,
  onCloseInvoice,
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
  generatedInvoiceNumber,
  modalLoading = false,
  calculateInvoiceTotals,
  getCurrencyInfo,
  formatCurrencyAmount,
  formatAmountInWords,
  useINROverride = false,
  onCurrencyToggle
}) => {
  const { subtotal, discountAmount, taxAmount, total } = calculateInvoiceTotals();
  const selectedCustomer = customers.find(c => c.id === invoiceFormData.customer_id);
  const nativeCurrencyInfo = getCurrencyInfo(selectedCustomer);
  // Allow override to bill foreign customer in INR
  const currencyInfo = useINROverride && nativeCurrencyInfo.code !== 'INR'
    ? { symbol: '₹', code: 'INR', name: 'Rupees' }
    : nativeCurrencyInfo;
  const isNonINRCustomer = nativeCurrencyInfo.code !== 'INR';
  const activeProducts = products.filter(p => p.is_active);
  const defaultCompany = companySettings.find(c => c.is_default) || companySettings[0];

  const getBankingLabel = (company: CompanySettings | undefined | null): string => {
    if (!company) return 'IFSC';
    const code = company.country_id?.toUpperCase();
    if (code === 'IN' || code === 'IND') return 'IFSC';
    if (code === 'IE' || code === 'IRL' || code === 'GB' || code === 'GBR' || code === 'UK') return 'IBAN';
    if (code === 'US' || code === 'USA') return 'Routing No';
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HU', 'IE', 'LV', 'LT', 'LU', 'MT', 'PL', 'PT', 'RO', 'SK', 'SI', 'SE', 'DE', 'FR', 'ES', 'IT', 'NL'];
    if (code && euCountries.includes(code)) return 'IBAN';
    return 'SWIFT/BIC';
  };

  // Get dynamic tax label based on customer's country
  const taxLabel = getTaxLabel(selectedCustomer);
  const classificationLabel = getClassificationCodeLabel(selectedCustomer);

  console.log('🎯 CreateInvoice - Rendering with data:', {
    items: invoiceFormData.items,
    itemsLength: invoiceFormData.items.length
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Create New Invoice</h1>
              <p className="text-slate-600 mt-1">Generate professional invoices for your customers</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onCloseInvoice}
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
                onClick={onSaveInvoice}
                disabled={modalLoading || !invoiceFormData.customer_id || !invoiceFormData.items[0]?.item_name || !invoiceFormData.items[0]?.description}
                className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {modalLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center mb-6">
                <FileText className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-slate-900">Invoice Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={generatedInvoiceNumber || "Generating..."}
                    disabled
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">Invoice number will be generated automatically</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer *
                  </label>
                  <select
                    value={invoiceFormData.customer_id}
                    onChange={(e) => onFormChange('customer_id', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.filter(customer => customer.is_active !== false).map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {formatCustomerOption(customer, companySettings)}
                      </option>
                    ))}
                  </select>

                  {/* Currency toggle — visible only for non-INR customers */}
                  {invoiceFormData.customer_id && isNonINRCustomer && onCurrencyToggle && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onCurrencyToggle}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          useINROverride
                            ? 'bg-orange-100 border-orange-400 text-orange-700 hover:bg-orange-200'
                            : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <RefreshCw className="w-3 h-3" />
                        {useINROverride
                          ? `Billing in ₹ INR (override)`
                          : `Billing in ${nativeCurrencyInfo.code} (default)`}
                      </button>
                      <span className="text-xs text-slate-500">
                        {useINROverride
                          ? `Click to revert to ${nativeCurrencyInfo.code}`
                          : 'Click to bill this customer in INR instead'}
                      </span>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceFormData.invoice_date}
                    onChange={(e) => onFormChange('invoice_date', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={invoiceFormData.due_date}
                    onChange={(e) => onFormChange('due_date', e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Project Details Section */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-4">Project Details (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Project Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Website Development"
                      value={invoiceFormData.project_title || ''}
                      onChange={(e) => onFormChange('project_title', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Estimated Time
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 2-3 weeks, 1 month"
                      value={invoiceFormData.estimated_time || ''}
                      onChange={(e) => onFormChange('estimated_time', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Company Contact Name
                    </label>
                    <input
                      type="text"
                      placeholder="Your contact person"
                      value={invoiceFormData.company_contact_name || ''}
                      onChange={(e) => onFormChange('company_contact_name', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Company Contact Email
                    </label>
                    <input
                      type="email"
                      placeholder="contact@company.com"
                      value={invoiceFormData.company_contact_email || ''}
                      onChange={(e) => onFormChange('company_contact_email', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Company Contact Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="+1234567890"
                      value={invoiceFormData.company_contact_phone || ''}
                      onChange={(e) => onFormChange('company_contact_phone', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Discount Section */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-4">Discount (Optional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Discount Type
                    </label>
                    <select
                      value={invoiceFormData.discount_type || ''}
                      onChange={(e) => onFormChange('discount_type', e.target.value ? e.target.value : '' as any)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option value="">No Discount</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>

                  {invoiceFormData.discount_type && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Discount Value {invoiceFormData.discount_type === 'percentage' ? '(%)' : `(${currencyInfo.symbol})`}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={invoiceFormData.discount_type === 'percentage' ? '10' : '100'}
                        value={invoiceFormData.discount_value || ''}
                        onChange={(e) => onFormChange('discount_value', e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  )}
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
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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

            {/* Line Items Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Package className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-slate-900">Line Items</h3>
                </div>
                <button
                  onClick={onAddItem}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {invoiceFormData.items.map((item, index) => {
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
                      <div className="mb-4">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.is_service_item || false}
                            onChange={(e) => onItemChange(index, 'is_service_item', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm font-medium text-slate-700">
                            Service-based billing (hours × resources)
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Item Name */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Item Name *
                          </label>
                          <input
                            type="text"
                            placeholder="Enter item name"
                            value={item.item_name}
                            onChange={(e) => onItemChange(index, 'item_name', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                            required
                          />
                        </div>
                        
                        {/* Quantity */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {item.is_service_item ? 'Duration (months)' : 'Quantity'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => onItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                          />
                        </div>

                        {/* Unit */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Unit
                          </label>
                          <input
                            type="text"
                            placeholder={item.is_service_item ? 'months' : 'pcs'}
                            value={item.unit}
                            onChange={(e) => onItemChange(index, 'unit', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                          />
                        </div>

                        {/* Unit Price */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            {item.is_service_item ? 'Hourly Rate' : 'Rate'} ({currencyInfo.symbol})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => onItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                          />
                        </div>
                      </div>

                      {/* Service Billing Fields */}
                      {item.is_service_item && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Billable Hours (per month)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="160"
                              value={item.billable_hours || ''}
                              onChange={(e) => onItemChange(index, 'billable_hours', parseFloat(e.target.value) || undefined)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">Total hours per month</p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Number of Resources
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="1"
                              value={item.resource_count || 1}
                              onChange={(e) => onItemChange(index, 'resource_count', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">e.g., 5 developers</p>
                          </div>
                        </div>
                      )}

                      
                      {/* Description and HSN Code */}
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Description *
                          </label>
                          <textarea
                            placeholder="Enter item description"
                            value={item.description}
                            onChange={(e) => onItemChange(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                            rows={2}
                            required
                          />
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
                              className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                            />
                          </div>
                          {invoiceFormData.items.length > 1 && (
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
                            {item.is_service_item && item.billable_hours ? (
                              <div className="text-xs text-slate-600">
                                {item.resource_count || 1} × {item.quantity} × {item.billable_hours} × {formatCurrencyAmount(item.unit_price, currencyInfo)} = {formatCurrencyAmount(lineSubtotal, currencyInfo)}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-600">
                                {item.quantity} × {formatCurrencyAmount(item.unit_price, currencyInfo)} = {formatCurrencyAmount(lineSubtotal, currencyInfo)}
                              </div>
                            )}
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

            {/* Indian Banking Details - shown when billing foreign customer in INR */}
            {useINROverride && isNonINRCustomer && defaultCompany && (
              <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
                <div className="flex items-center mb-4">
                  <div className="w-5 h-5 mr-2">🏦</div>
                  <h3 className="text-lg font-semibold text-slate-900">Indian Banking Details</h3>
                  <span className="ml-2 text-xs text-slate-500 font-normal">(from company settings — shown on PDF)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {defaultCompany.bank_name && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Bank Name</label>
                      <p className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium">{defaultCompany.bank_name}</p>
                    </div>
                  )}
                  {defaultCompany.account_number && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Account Number</label>
                      <p className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono">{defaultCompany.account_number}</p>
                    </div>
                  )}
                  {defaultCompany.ifsc_code && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">{getBankingLabel(defaultCompany)}</label>
                      <p className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono">{defaultCompany.ifsc_code}</p>
                    </div>
                  )}
                  {defaultCompany.branch_name && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Branch</label>
                      <p className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800">{defaultCompany.branch_name}</p>
                    </div>
                  )}
                  {!defaultCompany.bank_name && !defaultCompany.account_number && !defaultCompany.ifsc_code && (
                    <p className="md:col-span-2 text-sm text-slate-500 italic">No Indian banking details configured. Add them in Company Settings.</p>
                  )}
                </div>
              </div>
            )}

            {/* International Banking Details - shown only for non-INR customers (when not overridden) */}
            {currencyInfo.code !== 'INR' && (
              <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
                <div className="flex items-center mb-4">
                  <div className="w-5 h-5 mr-2 text-blue-600">🏦</div>
                  <h3 className="text-lg font-semibold text-slate-900">International Banking Details</h3>
                  <span className="ml-2 text-xs text-slate-500 font-normal">(shown on PDF for non-INR invoices)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Account Name - common to all regions */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Account Name</label>
                    <input
                      type="text"
                      value={invoiceFormData.intl_account_name || ''}
                      onChange={(e) => onFormChange('intl_account_name', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* EUR - IBAN + SWIFT/BIC + Address */}
                  {currencyInfo.code === 'EUR' && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">IBAN</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_iban || ''}
                          onChange={(e) => onFormChange('intl_iban', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">SWIFT / BIC</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_swift_bic || ''}
                          onChange={(e) => onFormChange('intl_swift_bic', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bank Address</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_bank_address || ''}
                          onChange={(e) => onFormChange('intl_bank_address', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </>
                  )}

                  {/* GBP - IBAN + Account Number + Sort Code + SWIFT/BIC + Address */}
                  {currencyInfo.code === 'GBP' && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">IBAN</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_iban || ''}
                          onChange={(e) => onFormChange('intl_iban', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Account Number</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_account_number || ''}
                          onChange={(e) => onFormChange('intl_account_number', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Sort Code</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_sort_code || ''}
                          onChange={(e) => onFormChange('intl_sort_code', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">SWIFT / BIC</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_swift_bic || ''}
                          onChange={(e) => onFormChange('intl_swift_bic', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bank Address</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_bank_address || ''}
                          onChange={(e) => onFormChange('intl_bank_address', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </>
                  )}

                  {/* USD - Account Number + Account Type + Routing Number + SWIFT/BIC + Address */}
                  {currencyInfo.code === 'USD' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Account Number</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_account_number || ''}
                          onChange={(e) => onFormChange('intl_account_number', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Account Type</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_account_type || ''}
                          onChange={(e) => onFormChange('intl_account_type', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Routing Number</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_routing_number || ''}
                          onChange={(e) => onFormChange('intl_routing_number', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">SWIFT / BIC</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_swift_bic || ''}
                          onChange={(e) => onFormChange('intl_swift_bic', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bank Address</label>
                        <input
                          type="text"
                          value={invoiceFormData.intl_bank_address || ''}
                          onChange={(e) => onFormChange('intl_bank_address', e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </>
                  )}

                  {/* Other non-INR currencies - show all fields */}
                  {currencyInfo.code !== 'EUR' && currencyInfo.code !== 'GBP' && currencyInfo.code !== 'USD' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">IBAN</label>
                        <input type="text" value={invoiceFormData.intl_iban || ''} onChange={(e) => onFormChange('intl_iban', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Account Number</label>
                        <input type="text" value={invoiceFormData.intl_account_number || ''} onChange={(e) => onFormChange('intl_account_number', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Account Type</label>
                        <input type="text" value={invoiceFormData.intl_account_type || ''} onChange={(e) => onFormChange('intl_account_type', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Sort Code</label>
                        <input type="text" value={invoiceFormData.intl_sort_code || ''} onChange={(e) => onFormChange('intl_sort_code', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Routing Number</label>
                        <input type="text" value={invoiceFormData.intl_routing_number || ''} onChange={(e) => onFormChange('intl_routing_number', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">SWIFT / BIC</label>
                        <input type="text" value={invoiceFormData.intl_swift_bic || ''} onChange={(e) => onFormChange('intl_swift_bic', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bank Address</label>
                        <input type="text" value={invoiceFormData.intl_bank_address || ''} onChange={(e) => onFormChange('intl_bank_address', e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Notes and Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={invoiceFormData.notes}
                  onChange={(e) => onFormChange('notes', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                  placeholder="Any additional notes for the customer..."
                />
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Terms & Conditions
                </label>
                {termsTemplates.length > 0 && (
                  <div className="mb-3">
                    <select
                      value={selectedTermsTemplateId}
                      onChange={(e) => onTermsTemplateSelect(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      {termsTemplates
                        .filter(template => template.category === 'general' || template.category === 'payment')
                        .map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <textarea
                  value={invoiceFormData.terms_conditions}
                  onChange={(e) => onTermsChange(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                  placeholder="Enter terms and conditions..."
                />
              </div>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Invoice Summary</h3>
              
              {selectedCustomer && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium text-slate-900 mb-2">Bill To:</h4>
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
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrencyAmount(subtotal, currencyInfo)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>
                      Discount ({invoiceFormData.discount_type === 'percentage' ? `${invoiceFormData.discount_value}%` : 'Fixed'}):
                    </span>
                    <span className="font-medium">- {formatCurrencyAmount(discountAmount, currencyInfo)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{taxLabel}:</span>
                  <span className="font-medium">{formatCurrencyAmount(taxAmount, currencyInfo)}</span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-slate-900">Total:</span>
                    <span className="text-blue-600">{formatCurrencyAmount(total, currencyInfo)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 italic">
                    {formatAmountInWords(total, currencyInfo.name)}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
