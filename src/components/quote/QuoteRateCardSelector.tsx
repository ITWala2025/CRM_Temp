import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calculator, DollarSign, X } from 'lucide-react';
import { rateCardService } from '../../services/rateCardService';
import type {
  RateCardTemplate,
  QuoteRateCard,
  RateCardCategory,
  ResourceLevel,
  CostHead,
} from '../../types/rateCard';
import { calculateTotalRate } from '../../types/rateCard';

interface QuoteRateCardSelectorProps {
  quoteId?: string;
  onRateCardsChange?: (rateCards: QuoteRateCard[]) => void;
  currency: 'USD' | 'INR';
}

const QuoteRateCardSelector: React.FC<QuoteRateCardSelectorProps> = ({
  quoteId,
  onRateCardsChange,
  currency,
}) => {
  const [templates, setTemplates] = useState<RateCardTemplate[]>([]);
  const [selectedRateCards, setSelectedRateCards] = useState<QuoteRateCard[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state for adding/editing rate card
  const [selectedTemplate, setSelectedTemplate] = useState<RateCardTemplate | null>(null);
  const [customRateCard, setCustomRateCard] = useState<{
    category: RateCardCategory;
    resource_level: ResourceLevel;
    rate_usd: number;
    rate_inr: number;
    cost_heads: CostHead[];
    quantity: number;
    unit: string;
    notes: string;
  }>({
    category: 'Full Stack Custom',
    resource_level: 'Junior',
    rate_usd: 0,
    rate_inr: 0,
    cost_heads: [],
    quantity: 1,
    unit: 'hour',
    notes: '',
  });

  useEffect(() => {
    loadTemplates();
    if (quoteId) {
      loadQuoteRateCards();
    }
  }, [quoteId]);

  useEffect(() => {
    if (onRateCardsChange) {
      onRateCardsChange(selectedRateCards);
    }
  }, [selectedRateCards]);

  const loadTemplates = async () => {
    try {
      const data = await rateCardService.getRateCardTemplates({ is_active: true });
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load rate card templates:', err);
    }
  };

  const loadQuoteRateCards = async () => {
    if (!quoteId) return;

    try {
      const data = await rateCardService.getQuoteRateCards(quoteId);
      setSelectedRateCards(data);
    } catch (err) {
      console.error('Failed to load quote rate cards:', err);
    }
  };

  const handleSelectTemplate = (template: RateCardTemplate) => {
    setSelectedTemplate(template);
    const calc = calculateTotalRate(template.base_rate_usd, template.base_rate_inr, template.cost_heads);

    setCustomRateCard({
      category: template.category,
      resource_level: template.resource_level,
      rate_usd: calc.total_rate_usd,
      rate_inr: calc.total_rate_inr,
      cost_heads: template.cost_heads,
      quantity: 1,
      unit: 'hour',
      notes: '',
    });
  };

  const handleAddRateCard = () => {
    const calc = calculateTotalRate(
      customRateCard.rate_usd,
      customRateCard.rate_inr,
      customRateCard.cost_heads
    );

    const newRateCard: QuoteRateCard = {
      id: `temp-${Date.now()}`,
      quote_id: quoteId,
      template_id: selectedTemplate?.id,
      category: customRateCard.category,
      resource_level: customRateCard.resource_level,
      rate_usd: calc.total_rate_usd,
      rate_inr: calc.total_rate_inr,
      cost_heads: customRateCard.cost_heads,
      quantity: customRateCard.quantity,
      unit: customRateCard.unit,
      subtotal_usd: calc.total_rate_usd * customRateCard.quantity,
      subtotal_inr: calc.total_rate_inr * customRateCard.quantity,
      notes: customRateCard.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSelectedRateCards([...selectedRateCards, newRateCard]);
    setShowAddModal(false);
    resetForm();
  };

  const handleEditRateCard = () => {
    if (editingIndex === null) return;

    const calc = calculateTotalRate(
      customRateCard.rate_usd,
      customRateCard.rate_inr,
      customRateCard.cost_heads
    );

    const updatedRateCards = [...selectedRateCards];
    updatedRateCards[editingIndex] = {
      ...updatedRateCards[editingIndex],
      category: customRateCard.category,
      resource_level: customRateCard.resource_level,
      rate_usd: calc.total_rate_usd,
      rate_inr: calc.total_rate_inr,
      cost_heads: customRateCard.cost_heads,
      quantity: customRateCard.quantity,
      unit: customRateCard.unit,
      subtotal_usd: calc.total_rate_usd * customRateCard.quantity,
      subtotal_inr: calc.total_rate_inr * customRateCard.quantity,
      notes: customRateCard.notes,
      updated_at: new Date().toISOString(),
    };

    setSelectedRateCards(updatedRateCards);
    setShowEditModal(false);
    setEditingIndex(null);
    resetForm();
  };

  const handleRemoveRateCard = (index: number) => {
    setSelectedRateCards(selectedRateCards.filter((_, i) => i !== index));
  };

  const handleEditClick = (index: number) => {
    const rateCard = selectedRateCards[index];
    setEditingIndex(index);
    setCustomRateCard({
      category: rateCard.category,
      resource_level: rateCard.resource_level,
      rate_usd: rateCard.rate_usd,
      rate_inr: rateCard.rate_inr,
      cost_heads: rateCard.cost_heads,
      quantity: rateCard.quantity,
      unit: rateCard.unit,
      notes: rateCard.notes || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setCustomRateCard({
      category: 'Full Stack Custom',
      resource_level: 'Junior',
      rate_usd: 0,
      rate_inr: 0,
      cost_heads: [],
      quantity: 1,
      unit: 'hour',
      notes: '',
    });
  };

  const updateCostHead = (index: number, field: keyof CostHead, value: any) => {
    const newCostHeads = [...customRateCard.cost_heads];
    newCostHeads[index] = { ...newCostHeads[index], [field]: value };

    // Auto-calculate values based on percentage
    if (field === 'percentage') {
      const percentage = parseFloat(value) || 0;
      const baseRateUSD = customRateCard.cost_heads.find(h => h.type === 'base')?.value || customRateCard.rate_usd;
      const baseRateINR = customRateCard.cost_heads.find(h => h.type === 'base')?.valueINR || customRateCard.rate_inr;

      newCostHeads[index].value = (baseRateUSD * percentage) / 100;
      newCostHeads[index].valueINR = (baseRateINR * percentage) / 100;
    }

    setCustomRateCard({ ...customRateCard, cost_heads: newCostHeads });
  };

  const totalUSD = selectedRateCards.reduce((sum, rc) => sum + rc.subtotal_usd, 0);
  const totalINR = selectedRateCards.reduce((sum, rc) => sum + rc.subtotal_inr, 0);

  const renderModal = (isEdit: boolean) => {
    const show = isEdit ? showEditModal : showAddModal;
    if (!show) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {isEdit ? 'Edit Resource' : 'Add Resource to Quote'}
              </h3>
              <button
                onClick={() => {
                  isEdit ? setShowEditModal(false) : setShowAddModal(false);
                  resetForm();
                  if (isEdit) setEditingIndex(null);
                }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Template Selection */}
              {!isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Template (Optional)
                  </label>
                  <select
                    onChange={(e) => {
                      const template = templates.find((t) => t.id === e.target.value);
                      if (template) handleSelectTemplate(template);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">-- Start from scratch or select a template --</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.template_name} ({template.category} - {template.resource_level})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category and Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={customRateCard.category}
                    onChange={(e) =>
                      setCustomRateCard({
                        ...customRateCard,
                        category: e.target.value as RateCardCategory,
                      })
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
                    Resource Level
                  </label>
                  <select
                    value={customRateCard.resource_level}
                    onChange={(e) =>
                      setCustomRateCard({
                        ...customRateCard,
                        resource_level: e.target.value as ResourceLevel,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                    <option value="Specialist">Specialist</option>
                  </select>
                </div>
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customRateCard.quantity}
                    onChange={(e) =>
                      setCustomRateCard({
                        ...customRateCard,
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={customRateCard.unit}
                    onChange={(e) =>
                      setCustomRateCard({ ...customRateCard, unit: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="hour">Hour</option>
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>
              </div>

              {/* Cost Heads Display */}
              {customRateCard.cost_heads.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rate Breakdown
                  </label>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {customRateCard.cost_heads.map((head, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-700">{head.name}</span>
                        <span className="font-medium">
                          ${head.value.toFixed(2)} / ₹{head.valueINR.toFixed(2)}
                          {head.percentage && ` (${head.percentage}%)`}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between font-semibold">
                      <span>Total Rate/{customRateCard.unit}</span>
                      <span className="text-green-600">
                        $
                        {calculateTotalRate(
                          customRateCard.rate_usd,
                          customRateCard.rate_inr,
                          customRateCard.cost_heads
                        ).total_rate_usd.toFixed(2)}{' '}
                        / ₹
                        {calculateTotalRate(
                          customRateCard.rate_usd,
                          customRateCard.rate_inr,
                          customRateCard.cost_heads
                        ).total_rate_inr.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={customRateCard.notes}
                  onChange={(e) =>
                    setCustomRateCard({ ...customRateCard, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Additional notes about this resource..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={isEdit ? handleEditRateCard : handleAddRateCard}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {isEdit ? 'Update Resource' : 'Add Resource'}
                </button>
                <button
                  onClick={() => {
                    isEdit ? setShowEditModal(false) : setShowAddModal(false);
                    resetForm();
                    if (isEdit) setEditingIndex(null);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md hover:from-red-600 hover:to-red-700 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Resource Rate Cards</h3>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Resource
        </button>
      </div>

      {/* Selected Rate Cards */}
      {selectedRateCards.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">No resources added yet.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Add your first resource
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {selectedRateCards.map((rateCard, index) => (
            <div
              key={rateCard.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900">
                      {rateCard.category} - {rateCard.resource_level}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                      {rateCard.quantity} {rateCard.unit}
                      {rateCard.quantity > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Rate: </span>
                      <span className="font-medium">
                        {currency === 'USD'
                          ? `$${rateCard.rate_usd.toFixed(2)}/${rateCard.unit}`
                          : `₹${rateCard.rate_inr.toFixed(2)}/${rateCard.unit}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Subtotal: </span>
                      <span className="font-semibold text-green-600">
                        {currency === 'USD'
                          ? `$${rateCard.subtotal_usd.toFixed(2)}`
                          : `₹${rateCard.subtotal_inr.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {rateCard.notes && (
                    <div className="mt-2 text-xs text-gray-500">{rateCard.notes}</div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEditClick(index)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveRateCard(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Total Resources Cost</span>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-blue-600">
                  {currency === 'USD' ? `$${totalUSD.toFixed(2)}` : `₹${totalINR.toFixed(2)}`}
                </div>
                <div className="text-xs text-gray-600">
                  {currency === 'USD' ? `₹${totalINR.toFixed(2)}` : `$${totalUSD.toFixed(2)}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {renderModal(false)}
      {renderModal(true)}
    </div>
  );
};

export default QuoteRateCardSelector;
