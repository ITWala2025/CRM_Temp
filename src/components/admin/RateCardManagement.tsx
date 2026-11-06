import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calculator,
  Save,
  X,
  Copy,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { rateCardService } from '../../services/rateCardService';
import { exchangeRateService } from '../../services/exchangeRateService';
import type {
  RateCardTemplate,
  CostHead,
  RateCardCategory,
  ResourceLevel,
  CreateRateCardTemplateData,
} from '../../types/rateCard';
import { calculateTotalRate, analyzeSalaryToRate } from '../../types/rateCard';
import SalaryRateAnalyzer from './SalaryRateAnalyzer';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useActionProgress } from '../../contexts/ActionProgressContext';
import ConfirmDialog from '../ui/ConfirmDialog';

const RateCardManagement: React.FC = () => {
  const { confirm, dialogProps } = useConfirmDialog();
  const { startAction, endAction } = useActionProgress();
  const [templates, setTemplates] = useState<RateCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<RateCardTemplate | null>(null);
  const [filterCategory, setFilterCategory] = useState<RateCardCategory | 'all'>('all');
  const [filterLevel, setFilterLevel] = useState<ResourceLevel | 'all'>('all');
  const [analyzerTemplate, setAnalyzerTemplate] = useState<RateCardTemplate | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(83.15); // USD to INR rate

  // Form state
  const [formData, setFormData] = useState<CreateRateCardTemplateData>({
    template_name: '',
    category: 'Full Stack Custom',
    resource_level: 'Junior',
    base_rate_usd: 0,
    base_rate_inr: 0,
    cost_heads: [],
    estimated_monthly_salary_usd: 0,
    estimated_monthly_salary_inr: 0,
    estimated_annual_salary_usd: 0,
    estimated_annual_salary_inr: 0,
    working_hours_per_month: 160,
    working_days_per_year: 220,
    salary_to_rate_multiplier: 1.75,
    is_active: true,
    is_default: false,
    description: '',
  });

  useEffect(() => {
    loadTemplates();
  }, [filterCategory, filterLevel]);

  // Fetch and auto-update exchange rate
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const rate = await exchangeRateService.getExchangeRate('USD', 'INR');
        if (rate) {
          setExchangeRate(rate);
          console.log(`✅ Exchange rate updated: 1 USD = ₹${rate}`);
        }
      } catch (err) {
        console.warn('Failed to fetch exchange rate, using fallback');
      }
    };

    fetchExchangeRate();

    // Auto-refresh exchange rate every 30 minutes
    const intervalId = setInterval(fetchExchangeRate, 30 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (filterCategory !== 'all') filters.category = filterCategory;
      if (filterLevel !== 'all') filters.resource_level = filterLevel;

      const data = await rateCardService.getRateCardTemplates(filters);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rate card templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setError(null);
      await rateCardService.createRateCardTemplate(formData);
      setActiveTab('list');
      resetForm();
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rate card template');
    }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;

    try {
      setError(null);
      await rateCardService.updateRateCardTemplate(selectedTemplate.id, formData);
      setActiveTab('list');
      resetForm();
      setSelectedTemplate(null);
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rate card template');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Rate Card Template',
      message: 'Are you sure you want to delete this rate card template? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!confirmed) return;

    startAction('Deleting rate card template…');
    try {
      setError(null);
      await rateCardService.deleteRateCardTemplate(id);
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rate card template');
    } finally {
      endAction();
    }
  };

  const handleEdit = (template: RateCardTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      template_name: template.template_name,
      category: template.category,
      resource_level: template.resource_level,
      base_rate_usd: template.base_rate_usd,
      base_rate_inr: template.base_rate_inr,
      cost_heads: template.cost_heads,
      estimated_monthly_salary_usd: template.estimated_monthly_salary_usd || 0,
      estimated_monthly_salary_inr: template.estimated_monthly_salary_inr || 0,
      estimated_annual_salary_usd: template.estimated_annual_salary_usd || 0,
      estimated_annual_salary_inr: template.estimated_annual_salary_inr || 0,
      working_hours_per_month: template.working_hours_per_month || 160,
      working_days_per_year: template.working_days_per_year || 220,
      salary_to_rate_multiplier: template.salary_to_rate_multiplier || 1.75,
      is_active: template.is_active,
      is_default: template.is_default,
      description: template.description,
    });
    setActiveTab('edit');
  };

  const handleDuplicate = (template: RateCardTemplate) => {
    setFormData({
      template_name: `${template.template_name} (Copy)`,
      category: template.category,
      resource_level: template.resource_level,
      base_rate_usd: template.base_rate_usd,
      base_rate_inr: template.base_rate_inr,
      cost_heads: template.cost_heads,
      estimated_monthly_salary_usd: template.estimated_monthly_salary_usd || 0,
      estimated_monthly_salary_inr: template.estimated_monthly_salary_inr || 0,
      estimated_annual_salary_usd: template.estimated_annual_salary_usd || 0,
      estimated_annual_salary_inr: template.estimated_annual_salary_inr || 0,
      working_hours_per_month: template.working_hours_per_month || 160,
      working_days_per_year: template.working_days_per_year || 220,
      salary_to_rate_multiplier: template.salary_to_rate_multiplier || 1.75,
      is_active: true,
      is_default: false,
      description: template.description,
    });
    setActiveTab('create');
  };

  const resetForm = () => {
    setFormData({
      template_name: '',
      category: 'Full Stack Custom',
      resource_level: 'Junior',
      base_rate_usd: 0,
      base_rate_inr: 0,
      cost_heads: [],
      estimated_monthly_salary_usd: 0,
      estimated_monthly_salary_inr: 0,
      estimated_annual_salary_usd: 0,
      estimated_annual_salary_inr: 0,
      working_hours_per_month: 160,
      working_days_per_year: 220,
      salary_to_rate_multiplier: 1.75,
      is_active: true,
      is_default: false,
      description: '',
    });
  };

  const addCostHead = () => {
    setFormData({
      ...formData,
      cost_heads: [
        ...formData.cost_heads,
        {
          name: '',
          percentage: 0,
          value: 0,
          valueINR: 0,
          type: 'percentage',
        },
      ],
    });
  };

  const updateCostHead = (index: number, field: keyof CostHead, value: any) => {
    const newCostHeads = [...formData.cost_heads];
    newCostHeads[index] = { ...newCostHeads[index], [field]: value };

    // Auto-calculate values based on percentage
    if (field === 'percentage') {
      const percentage = parseFloat(value) || 0;
      newCostHeads[index].value = parseFloat(((formData.base_rate_usd * percentage) / 100).toFixed(2));
      newCostHeads[index].valueINR = parseFloat(((formData.base_rate_inr * percentage) / 100).toFixed(2));
      newCostHeads[index].percentage = percentage;
    }

    setFormData({ ...formData, cost_heads: newCostHeads });
  };

  const removeCostHead = (index: number) => {
    setFormData({
      ...formData,
      cost_heads: formData.cost_heads.filter((_, i) => i !== index),
    });
  };

  const calculation = calculateTotalRate(
    formData.base_rate_usd,
    formData.base_rate_inr,
    formData.cost_heads
  );

  // Render List View
  const renderListView = () => {
    const categories: RateCardCategory[] = ['Full Stack Custom', 'AI/ML', 'Non Technical Roles'];
    const levels: ResourceLevel[] = ['Junior', 'Senior', 'Specialist'];

    return (
      <div>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Rate Card Templates</h2>
            <p className="text-gray-600 mt-1">Manage consulting engagement rate cards</p>
          </div>
          <button
            onClick={() => setActiveTab('create')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as RateCardCategory | 'all')}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resource Level</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as ResourceLevel | 'all')}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Levels</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No rate card templates found.</p>
            <button
              onClick={() => setActiveTab('create')}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Create your first template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => {
              const calc = calculateTotalRate(
                template.base_rate_usd,
                template.base_rate_inr,
                template.cost_heads
              );

              return (
                <div
                  key={template.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{template.template_name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {template.category} • {template.resource_level}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {template.is_default && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          Default
                        </span>
                      )}
                      {!template.is_active && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    {template.estimated_monthly_salary_usd && (
                      <div className="bg-purple-50 rounded px-2 py-1.5">
                        <div className="text-xs text-gray-600">Est. Monthly Salary:</div>
                        <div className="text-sm font-medium text-purple-900">
                          ${template.estimated_monthly_salary_usd.toLocaleString()} / ₹
                          {template.estimated_monthly_salary_inr?.toLocaleString()}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Base Rate (USD):</span>
                      <span className="font-medium text-gray-900">
                        ${template.base_rate_usd.toFixed(2)}/hr
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Base Rate (INR):</span>
                      <span className="font-medium text-gray-900">
                        ₹{template.base_rate_inr.toFixed(2)}/hr
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Total Rate (USD):</span>
                        <span className="font-semibold text-green-600">
                          ${calc.total_rate_usd.toFixed(2)}/hr
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm font-medium text-gray-700">Total Rate (INR):</span>
                        <span className="font-semibold text-green-600">
                          ₹{calc.total_rate_inr.toFixed(2)}/hr
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {template.cost_heads.length} cost heads
                      {template.estimated_monthly_salary_usd && (() => {
                        const analysis = analyzeSalaryToRate(template);
                        return analysis ? (
                          <span className="ml-2 text-purple-600">
                            • {analysis.markup_percentage.toFixed(0)}% markup
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {template.estimated_monthly_salary_usd && (
                      <button
                        onClick={() => setAnalyzerTemplate(template)}
                        className="flex-1 flex items-center justify-center px-3 py-2 text-sm bg-purple-50 text-purple-600 rounded hover:bg-purple-100"
                        title="Salary vs Rate Analysis"
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        Analyze
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(template)}
                      className="flex-1 flex items-center justify-center px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(template)}
                      className="flex items-center justify-center px-3 py-2 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="flex items-center justify-center px-3 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render Form View (Create/Edit)
  const renderFormView = () => {
    const isEdit = activeTab === 'edit';

    return (
      <div>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setActiveTab('list');
                resetForm();
                setSelectedTemplate(null);
              }}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isEdit ? 'Edit Template' : 'Create Template'}
              </h2>
              <p className="text-gray-600 mt-1">
                {isEdit ? 'Update rate card template' : 'Create a new rate card template'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={formData.template_name}
                      onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., Full Stack Senior Developer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value as RateCardCategory })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Full Stack Custom">Full Stack Custom</option>
                      <option value="AI/ML">AI/ML</option>
                      <option value="Non Technical Roles">Non Technical Roles</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Resource Level *
                    </label>
                    <select
                      value={formData.resource_level}
                      onChange={(e) =>
                        setFormData({ ...formData, resource_level: e.target.value as ResourceLevel })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Junior">Junior</option>
                      <option value="Senior">Senior</option>
                      <option value="Specialist">Specialist</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base Rate (USD/hr) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.base_rate_usd}
                      onChange={(e) => {
                        const usdRate = parseFloat(e.target.value) || 0;
                        const inrRate = parseFloat((usdRate * exchangeRate).toFixed(2));

                        // Recalculate cost heads with new base rate
                        const updatedCostHeads = formData.cost_heads.map((head) => {
                          // Update base type cost heads with the new base rate
                          if (head.type === 'base') {
                            return {
                              ...head,
                              value: usdRate,
                              valueINR: inrRate,
                            };
                          }
                          // Update percentage-based cost heads
                          if (head.percentage) {
                            return {
                              ...head,
                              value: parseFloat(((usdRate * head.percentage) / 100).toFixed(2)),
                              valueINR: parseFloat(((inrRate * head.percentage) / 100).toFixed(2)),
                            };
                          }
                          return head;
                        });

                        setFormData({
                          ...formData,
                          base_rate_usd: usdRate,
                          base_rate_inr: inrRate,
                          cost_heads: updatedCostHeads,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Rate: 1 USD = ₹{exchangeRate.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base Rate (INR/hr) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.base_rate_inr}
                      onChange={(e) => {
                        const inrRate = parseFloat(e.target.value) || 0;
                        const usdRate = parseFloat((inrRate / exchangeRate).toFixed(2));

                        // Recalculate cost heads with new base rate
                        const updatedCostHeads = formData.cost_heads.map((head) => {
                          // Update base type cost heads with the new base rate
                          if (head.type === 'base') {
                            return {
                              ...head,
                              value: usdRate,
                              valueINR: inrRate,
                            };
                          }
                          // Update percentage-based cost heads
                          if (head.percentage) {
                            return {
                              ...head,
                              value: parseFloat(((usdRate * head.percentage) / 100).toFixed(2)),
                              valueINR: parseFloat(((inrRate * head.percentage) / 100).toFixed(2)),
                            };
                          }
                          return head;
                        });

                        setFormData({
                          ...formData,
                          base_rate_usd: usdRate,
                          base_rate_inr: inrRate,
                          cost_heads: updatedCostHeads,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Auto-calculated from USD
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={3}
                      placeholder="Brief description of this rate card..."
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_default}
                        onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Default Template</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Salary Information */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary Information (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Salary (USD)
                    </label>
                    <input
                      type="number"
                      step="100"
                      value={formData.estimated_monthly_salary_usd}
                      onChange={(e) => {
                        const monthlyUSD = parseFloat(e.target.value) || 0;
                        const monthlyINR = parseFloat((monthlyUSD * exchangeRate).toFixed(2));
                        setFormData({
                          ...formData,
                          estimated_monthly_salary_usd: monthlyUSD,
                          estimated_monthly_salary_inr: monthlyINR,
                          estimated_annual_salary_usd: monthlyUSD * 12,
                          estimated_annual_salary_inr: monthlyINR * 12,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 4000"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Rate: 1 USD = ₹{exchangeRate.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Salary (INR)
                    </label>
                    <input
                      type="number"
                      step="1000"
                      value={formData.estimated_monthly_salary_inr}
                      onChange={(e) => {
                        const monthlyINR = parseFloat(e.target.value) || 0;
                        const monthlyUSD = parseFloat((monthlyINR / exchangeRate).toFixed(2));
                        setFormData({
                          ...formData,
                          estimated_monthly_salary_usd: monthlyUSD,
                          estimated_monthly_salary_inr: monthlyINR,
                          estimated_annual_salary_usd: monthlyUSD * 12,
                          estimated_annual_salary_inr: monthlyINR * 12,
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 320000"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Auto-calculated from USD
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Working Hours/Month
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={formData.working_hours_per_month}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          working_hours_per_month: parseFloat(e.target.value) || 160,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Overhead Multiplier
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={formData.salary_to_rate_multiplier}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          salary_to_rate_multiplier: parseFloat(e.target.value) || 1.75,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      e.g., 1.75 = 75% overhead
                    </div>
                  </div>
                </div>

                {/* Base Rate Recommender */}
                {formData.estimated_monthly_salary_usd && formData.working_hours_per_month && formData.salary_to_rate_multiplier && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Calculator className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">💡 Recommended Base Rate</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-white rounded-md p-3 border border-green-200">
                            <div className="text-xs text-gray-600 mb-1">Recommended USD Rate</div>
                            <div className="text-2xl font-bold text-green-600">
                              ${((formData.estimated_monthly_salary_usd / formData.working_hours_per_month) * formData.salary_to_rate_multiplier).toFixed(2)}/hr
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Current: ${formData.base_rate_usd.toFixed(2)}/hr
                            </div>
                          </div>
                          <div className="bg-white rounded-md p-3 border border-green-200">
                            <div className="text-xs text-gray-600 mb-1">Recommended INR Rate</div>
                            <div className="text-2xl font-bold text-green-600">
                              ₹{(((formData.estimated_monthly_salary_inr || 0) / (formData.working_hours_per_month || 160)) * (formData.salary_to_rate_multiplier || 1.75)).toFixed(2)}/hr
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Current: ₹{formData.base_rate_inr.toFixed(2)}/hr
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const recommendedUSD = parseFloat((((formData.estimated_monthly_salary_usd || 0) / (formData.working_hours_per_month || 160)) * (formData.salary_to_rate_multiplier || 1.75)).toFixed(2));
                            const recommendedINR = parseFloat((((formData.estimated_monthly_salary_inr || 0) / (formData.working_hours_per_month || 160)) * (formData.salary_to_rate_multiplier || 1.75)).toFixed(2));

                            // Update base rates and recalculate cost heads
                            const updatedCostHeads = formData.cost_heads.map((head) => {
                              if (head.type === 'base') {
                                return {
                                  ...head,
                                  value: recommendedUSD,
                                  valueINR: recommendedINR,
                                };
                              }
                              if (head.percentage) {
                                return {
                                  ...head,
                                  value: parseFloat(((recommendedUSD * head.percentage) / 100).toFixed(2)),
                                  valueINR: parseFloat(((recommendedINR * head.percentage) / 100).toFixed(2)),
                                };
                              }
                              return head;
                            });

                            setFormData({
                              ...formData,
                              base_rate_usd: recommendedUSD,
                              base_rate_inr: recommendedINR,
                              cost_heads: updatedCostHeads,
                            });
                          }}
                          className="mt-3 w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                        >
                          Apply Recommended Base Rate
                        </button>
                        <div className="mt-2 text-xs text-gray-600">
                          <strong>Formula:</strong> (Monthly Salary ÷ Working Hours) × Overhead Multiplier
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cost Heads */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Cost Heads</h3>
                  <button
                    onClick={addCostHead}
                    className="flex items-center px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Cost Head
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.cost_heads.map((costHead, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg items-end"
                    >
                      <div className="col-span-4">
                        <label className="block text-xs text-gray-600 mb-1">Name</label>
                        <input
                          type="text"
                          value={costHead.name}
                          onChange={(e) => updateCostHead(index, 'name', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="e.g., Benefits"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">%</label>
                        <input
                          type="number"
                          step="0.01"
                          value={costHead.percentage || 0}
                          onChange={(e) => updateCostHead(index, 'percentage', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">USD</label>
                        <input
                          type="text"
                          value={costHead.value?.toFixed(2) || '0.00'}
                          readOnly
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded bg-gray-100"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-600 mb-1">INR</label>
                        <input
                          type="text"
                          value={costHead.valueINR?.toFixed(2) || '0.00'}
                          readOnly
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded bg-gray-100"
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <button
                          onClick={() => removeCostHead(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {formData.cost_heads.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No cost heads added yet. Click "Add Cost Head" to begin.
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={isEdit ? handleUpdate : handleCreate}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isEdit ? 'Update Template' : 'Create Template'}
                </button>
                <button
                  onClick={() => {
                    setActiveTab('list');
                    resetForm();
                    setSelectedTemplate(null);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md hover:from-red-600 hover:to-red-700 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Rate Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Rate Summary</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Base Rate</div>
                  <div className="text-lg font-semibold text-gray-900">
                    ${calculation.base_rate_usd.toFixed(2)} / ₹{calculation.base_rate_inr.toFixed(2)}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="text-sm text-gray-600 mb-2">Cost Heads Total</div>
                  <div className="text-base font-medium text-gray-700">
                    ${calculation.total_cost_heads_usd.toFixed(2)} / ₹
                    {calculation.total_cost_heads_inr.toFixed(2)}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="text-sm text-gray-600 mb-2">Total Hourly Rate</div>
                  <div className="text-xl font-bold text-green-600">
                    ${calculation.total_rate_usd.toFixed(2)}
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    ₹{calculation.total_rate_inr.toFixed(2)}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Monthly (160 hrs): ${(calculation.total_rate_usd * 160).toFixed(2)}</div>
                    <div>Monthly (160 hrs): ₹{(calculation.total_rate_inr * 160).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center px-6">
        <h1 className="text-xl font-semibold text-gray-900">Rate Card Management</h1>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {activeTab === 'list' && renderListView()}
        {(activeTab === 'create' || activeTab === 'edit') && renderFormView()}
      </main>

      {/* Salary Analyzer Modal */}
      {analyzerTemplate && (
        <SalaryRateAnalyzer
          template={analyzerTemplate}
          onClose={() => setAnalyzerTemplate(null)}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default RateCardManagement;
