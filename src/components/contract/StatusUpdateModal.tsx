import React, { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import type { ContractStatus } from '../../types/contract';

interface StatusUpdateModalProps {
  contractId: string;
  contractNumber: string;
  currentStatus: ContractStatus;
  onUpdate: (newStatus: ContractStatus) => Promise<void>;
  onClose: () => void;
}

const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({
  contractNumber,
  currentStatus,
  onUpdate,
  onClose
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ContractStatus>(currentStatus);
  const [loading, setLoading] = useState(false);

  const statuses: { value: ContractStatus; label: string; color: string; description: string }[] = [
    {
      value: 'draft',
      label: 'Draft',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      description: 'Contract is being prepared and not yet finalized'
    },
    {
      value: 'sent',
      label: 'Sent',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      description: 'Contract has been sent to the other party for review'
    },
    {
      value: 'accepted',
      label: 'Accepted',
      color: 'bg-teal-100 text-teal-800 border-teal-300',
      description: 'Contract has been accepted by the other party'
    },
    {
      value: 'rejected',
      label: 'Rejected',
      color: 'bg-red-100 text-red-800 border-red-300',
      description: 'Contract has been rejected and needs revision'
    },
    {
      value: 'active',
      label: 'Active',
      color: 'bg-green-100 text-green-800 border-green-300',
      description: 'Contract is currently in effect and operational'
    },
    {
      value: 'expired',
      label: 'Expired',
      color: 'bg-red-100 text-red-800 border-red-300',
      description: 'Contract has reached its end date and is no longer valid'
    },
    {
      value: 'terminated',
      label: 'Terminated',
      color: 'bg-orange-100 text-orange-800 border-orange-300',
      description: 'Contract has been terminated before expiry date'
    },
    {
      value: 'renewed',
      label: 'Renewed',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      description: 'Contract has been renewed with new terms'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedStatus === currentStatus) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      await onUpdate(selectedStatus);
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-base font-bold text-white">Update Status</h2>
              <p className="text-purple-100 text-xs">{contractNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-purple-800 rounded-full p-1 transition-colors"
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-3">
            <p className="text-xs text-gray-600 mb-2">
              Current: <span className="font-semibold text-gray-900">{currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}</span>
            </p>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {statuses.map((status) => (
              <label
                key={status.value}
                className={`flex items-center justify-between p-2 border rounded-md cursor-pointer transition-all ${
                  selectedStatus === status.value
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value={status.value}
                    checked={selectedStatus === status.value}
                    onChange={(e) => setSelectedStatus(e.target.value as ContractStatus)}
                    className="mr-2 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-900">{status.label}</span>
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${status.color}`}>
                  {status.label}
                </span>
              </label>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md hover:from-red-600 hover:to-red-700 transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedStatus === currentStatus}
              className="flex items-center px-4 py-1.5 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5"></div>
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Update Status
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StatusUpdateModal;
