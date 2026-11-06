import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Calculator, BarChart3, AlertCircle } from 'lucide-react';
import type { RateCardTemplate } from '../../types/rateCard';
import {
  analyzeSalaryToRate,
  simulateSalaryChange,
  calculateRateFromSalary,
} from '../../types/rateCard';
import { exchangeRateService } from '../../services/exchangeRateService';

interface SalaryRateAnalyzerProps {
  template: RateCardTemplate;
  onClose: () => void;
}

const SalaryRateAnalyzer: React.FC<SalaryRateAnalyzerProps> = ({ template, onClose }) => {
  const [simulatedSalaryUSD, setSimulatedSalaryUSD] = useState(
    template.estimated_monthly_salary_usd || 0
  );
  const [simulatedSalaryINR, setSimulatedSalaryINR] = useState(
    template.estimated_monthly_salary_inr || 0
  );
  const [exchangeRate, setExchangeRate] = useState<number>(83.15);

  // Fetch exchange rate on mount and auto-refresh every 30 minutes
  useEffect(() => {
    const fetchExchangeRate = async () => {
      const rate = await exchangeRateService.getExchangeRate('USD', 'INR');
      if (rate) {
        setExchangeRate(rate);
      }
    };

    fetchExchangeRate();
    const intervalId = setInterval(fetchExchangeRate, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(intervalId);
  }, []);

  const analysis = analyzeSalaryToRate(template);
  const workingHours = template.working_hours_per_month || 160;
  const overheadPercentage = ((template.salary_to_rate_multiplier || 1.75) - 1) * 100;

  const simulation =
    template.estimated_monthly_salary_usd && template.estimated_monthly_salary_inr
      ? simulateSalaryChange(
          template.estimated_monthly_salary_usd,
          template.estimated_monthly_salary_inr,
          simulatedSalaryUSD,
          simulatedSalaryINR,
          workingHours,
          overheadPercentage
        )
      : null;

  const newRecommendedRate = calculateRateFromSalary(
    simulatedSalaryUSD,
    simulatedSalaryINR,
    workingHours,
    overheadPercentage
  );

  if (!analysis) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full p-6">
          <div className="flex items-center gap-3 text-yellow-600 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Salary Data Not Available</h3>
          </div>
          <p className="text-gray-600 mb-6">
            This rate card template does not have salary information configured. Please edit the
            template to add salary data for analysis.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{template.template_name}</h3>
              <p className="text-gray-600 mt-1">
                Salary vs Rate Analysis • {template.category} • {template.resource_level}
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Current Analysis */}
            <div className="space-y-6">
              {/* Salary Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">Salary Information</h4>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Monthly Salary</div>
                      <div className="text-lg font-semibold text-blue-900">
                        ${analysis.monthly_salary_usd.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-700">
                        ₹{analysis.monthly_salary_inr.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Annual Salary</div>
                      <div className="text-lg font-semibold text-blue-900">
                        ${analysis.annual_salary_usd.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-700">
                        ₹{analysis.annual_salary_inr.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-blue-300 pt-3">
                    <div className="text-xs text-gray-600 mb-1">Hourly Salary Equivalent</div>
                    <div className="text-base font-medium text-gray-900">
                      ${analysis.hourly_salary_equivalent_usd}/hr • ₹
                      {analysis.hourly_salary_equivalent_inr}/hr
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Based on {analysis.working_hours_per_month} hours/month
                    </div>
                  </div>
                </div>
              </div>

              {/* Rate Information */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-gray-900">Total Billable Rate</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Current Total Hourly Rate</div>
                    <div className="text-2xl font-bold text-green-600">
                      ${analysis.hourly_rate_usd.toFixed(2)}/hr
                    </div>
                    <div className="text-lg font-semibold text-green-700">
                      ₹{analysis.hourly_rate_inr.toFixed(2)}/hr
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      ℹ️ Includes base rate + all cost heads
                    </div>
                  </div>

                  <div className="border-t border-green-300 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Markup Amount:</span>
                      <span className="font-medium">
                        ${analysis.markup_amount_usd.toFixed(2)} / ₹
                        {analysis.markup_amount_inr.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Markup Percentage:</span>
                      <span className="font-semibold text-green-600">
                        {analysis.markup_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue Projections */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold text-gray-900">Revenue Projections</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Potential Monthly Revenue</div>
                    <div className="text-lg font-semibold text-purple-900">
                      ${analysis.potential_monthly_revenue_usd.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-700">
                      ₹{analysis.potential_monthly_revenue_inr.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-600 mb-1">Potential Annual Revenue</div>
                    <div className="text-xl font-bold text-purple-900">
                      ${analysis.potential_annual_revenue_usd.toLocaleString()}
                    </div>
                    <div className="text-base font-semibold text-gray-700">
                      ₹{analysis.potential_annual_revenue_inr.toLocaleString()}
                    </div>
                  </div>

                  <div className="border-t border-purple-300 pt-3">
                    <div className="text-xs text-gray-600 mb-2">Gross Margin</div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Amount (Annual):</span>
                      <span className="font-medium">
                        ${analysis.gross_margin_usd.toLocaleString()} / ₹
                        {analysis.gross_margin_inr.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm text-gray-700">Margin %:</span>
                      <span className="font-semibold text-purple-600">
                        {analysis.gross_margin_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Simulation */}
            <div className="space-y-6">
              {/* Salary Change Simulator */}
              <div className="bg-white border-2 border-indigo-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-semibold text-gray-900">Salary Change Simulator</h4>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Adjust the monthly salary to see how it affects the billable rate
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Monthly Salary (USD)
                    </label>
                    <input
                      type="number"
                      step="100"
                      value={simulatedSalaryUSD}
                      onChange={(e) => {
                        const usdValue = parseFloat(e.target.value) || 0;
                        const inrValue = parseFloat((usdValue * exchangeRate).toFixed(2));
                        setSimulatedSalaryUSD(usdValue);
                        setSimulatedSalaryINR(inrValue);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <div className="mt-1 text-xs text-gray-500">
                      Original: ${template.estimated_monthly_salary_usd?.toLocaleString()} • Rate: 1 USD = ₹{exchangeRate.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Monthly Salary (INR)
                    </label>
                    <input
                      type="number"
                      step="1000"
                      value={simulatedSalaryINR}
                      onChange={(e) => {
                        const inrValue = parseFloat(e.target.value) || 0;
                        const usdValue = parseFloat((inrValue / exchangeRate).toFixed(2));
                        setSimulatedSalaryINR(inrValue);
                        setSimulatedSalaryUSD(usdValue);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <div className="mt-1 text-xs text-gray-500">
                      Original: ₹{template.estimated_monthly_salary_inr?.toLocaleString()} • Auto-calculated from USD
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Results */}
              {simulation && (
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Impact Analysis</h4>

                  <div className="space-y-4">
                    {/* Salary Change */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Salary Change</div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">USD:</span>
                        <span
                          className={`font-semibold ${
                            simulation.new_monthly_salary_usd > simulation.original_monthly_salary_usd
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {simulation.new_monthly_salary_usd > simulation.original_monthly_salary_usd
                            ? '+'
                            : ''}
                          $
                          {(
                            simulation.new_monthly_salary_usd - simulation.original_monthly_salary_usd
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-600">INR:</span>
                        <span
                          className={`font-semibold ${
                            simulation.new_monthly_salary_inr > simulation.original_monthly_salary_inr
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {simulation.new_monthly_salary_inr > simulation.original_monthly_salary_inr
                            ? '+'
                            : ''}
                          ₹
                          {(
                            simulation.new_monthly_salary_inr - simulation.original_monthly_salary_inr
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Recommended New Rate */}
                    <div className="border-t border-orange-300 pt-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Recommended New Rate
                      </div>
                      <div className="text-2xl font-bold text-orange-600">
                        ${simulation.new_rate_usd.toFixed(2)}/hr
                      </div>
                      <div className="text-lg font-semibold text-orange-700">
                        ₹{simulation.new_rate_inr.toFixed(2)}/hr
                      </div>
                    </div>

                    {/* Rate Change */}
                    <div className="border-t border-orange-300 pt-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">Rate Change</div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Amount:</span>
                        <span
                          className={`font-semibold ${
                            simulation.rate_change_usd > 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {simulation.rate_change_usd > 0 ? '+' : ''}$
                          {simulation.rate_change_usd.toFixed(2)} /
                          {simulation.rate_change_inr > 0 ? '+' : ''}₹
                          {simulation.rate_change_inr.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-600">Percentage:</span>
                        <span
                          className={`font-semibold ${
                            simulation.rate_change_percentage > 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {simulation.rate_change_percentage > 0 ? '+' : ''}
                          {simulation.rate_change_percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Annual Cost Impact */}
                    <div className="border-t border-orange-300 pt-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Annual Cost Impact
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">USD:</span>
                        <span
                          className={`font-semibold ${
                            simulation.annual_cost_impact_usd > 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {simulation.annual_cost_impact_usd > 0 ? '+' : ''}$
                          {simulation.annual_cost_impact_usd.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-600">INR:</span>
                        <span
                          className={`font-semibold ${
                            simulation.annual_cost_impact_inr > 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {simulation.annual_cost_impact_inr > 0 ? '+' : ''}₹
                          {simulation.annual_cost_impact_inr.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Working Parameters */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Working Parameters</h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-600">Working Hours/Month:</div>
                    <div className="font-medium">{analysis.working_hours_per_month}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Working Days/Year:</div>
                    <div className="font-medium">{analysis.working_days_per_year}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Overhead Multiplier:</div>
                    <div className="font-medium">{analysis.overhead_multiplier}x</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Overhead %:</div>
                    <div className="font-medium">{overheadPercentage.toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalaryRateAnalyzer;
