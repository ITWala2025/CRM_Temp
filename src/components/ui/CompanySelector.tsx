import React from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import type { CompanySettings } from '../../types/invoice';

interface CompanySelectorProps {
  companies: CompanySettings[];
  selectedId: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

const CompanySelector: React.FC<CompanySelectorProps> = ({
  companies,
  selectedId,
  onChange,
  disabled = false,
  className = '',
}) => {
  if (!companies.length) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <Building2 className="w-4 h-4" />
        <span>No companies configured</span>
      </div>
    );
  }

  const selected = companies.find(c => c.id === selectedId) || companies[0];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
      <select
        value={selectedId ?? companies[0]?.id ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {companies.map(c => (
          <option key={c.id} value={c.id}>
            {c.company_name} {c.is_default ? '(Default)' : ''}
          </option>
        ))}
      </select>
      {selected?.is_default && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Default
        </span>
      )}
    </div>
  );
};

export default CompanySelector;
