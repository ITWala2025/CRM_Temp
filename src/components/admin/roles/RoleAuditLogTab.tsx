import React, { useState, useEffect } from 'react';
import {
  History,
  Shield,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  PlusCircle,
  Clock,
  User,
  Filter,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { RoleAuditLog } from '../../../types/role';
import { RoleService } from '../../../services/roleService';

export const RoleAuditLogTab: React.FC = () => {
  const [logs, setLogs] = useState<RoleAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await RoleService.getAuditLogs(100);
      setLogs(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    return true;
  });

  const getActionBadge = (action: RoleAuditLog['action']) => {
    switch (action) {
      case 'role_created':
        return {
          label: 'Role Created',
          icon: PlusCircle,
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'role_updated':
        return {
          label: 'Role Modified',
          icon: Edit2,
          className: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'role_deleted':
        return {
          label: 'Role Deleted',
          icon: Trash2,
          className: 'bg-red-50 text-red-700 border-red-200',
        };
      case 'user_assigned':
        return {
          label: 'User Assigned',
          icon: UserCheck,
          className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        };
      case 'user_revoked':
        return {
          label: 'User Revoked',
          icon: UserX,
          className: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'role_duplicated':
        return {
          label: 'Role Cloned',
          icon: Shield,
          className: 'bg-purple-50 text-purple-700 border-purple-200',
        };
      default:
        return {
          label: action,
          icon: History,
          className: 'bg-gray-100 text-gray-700 border-gray-200',
        };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Filter & Refresh Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            RBAC Modification Audit History
          </span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-700"
          >
            <option value="all">All Audit Actions</option>
            <option value="role_created">Role Created</option>
            <option value="role_updated">Role Modified</option>
            <option value="role_deleted">Role Deleted</option>
            <option value="user_assigned">User Assigned</option>
            <option value="user_revoked">User Revoked</option>
          </select>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded-md w-1/3 mx-auto" />
            <div className="h-20 bg-gray-50 rounded-xl" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-400">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">No audit activities logged yet</h3>
            <p className="text-xs text-gray-500">
              Role creations, updates, and user assignments will be automatically recorded here with timestamps.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map(log => {
              const badge = getActionBadge(log.action);
              const Icon = badge.icon;

              return (
                <div key={log.id} className="p-4 hover:bg-gray-50/60 transition-colors flex items-start gap-4">
                  <div className={`p-2 rounded-xl border ${badge.className} flex-shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="font-bold text-sm text-gray-900 truncate">
                          {log.target_name || log.target_id}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-gray-400 font-medium flex-shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" />
                        Performed by: <strong className="text-gray-700">{log.performed_by || 'Admin'}</strong>
                      </span>

                      {log.details && Object.keys(log.details).length > 0 && (
                        <span className="font-mono text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {JSON.stringify(log.details)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
