import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { ServiceRequest, ServiceRequestStatus } from '../../types';
import {
  Bell,
  CheckCircle2,
  Clock,
  Volume2,
  Receipt,
  Droplets,
  Utensils,
  Sparkles,
  Search,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const ServiceDeskView: React.FC = () => {
  const {
    restaurant,
    serviceRequests,
    updateServiceRequestStatus,
    soundEnabled,
  } = useRestaurant();
  const acknowledgeServiceRequest = (id: string) => updateServiceRequestStatus(id, 'acknowledged');
  const resolveServiceRequest = (id: string) => updateServiceRequestStatus(id, 'resolved');

  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'acknowledged' | 'resolved'>('all');

  const filteredRequests = serviceRequests.filter(req => {
    if (filterStatus === 'all') return true;
    return req.status === filterStatus;
  });

  const openCount = serviceRequests.filter(r => r.status === 'open').length;
  const ackCount = serviceRequests.filter(r => r.status === 'acknowledged').length;
  const resolvedCount = serviceRequests.filter(r => r.status === 'resolved').length;

  const getServiceTypeIcon = (type: ServiceRequest['type']) => {
    switch (type) {
      case 'call_waiter':
        return <Bell className="w-5 h-5 text-indigo-600" />;
      case 'need_water':
        return <Droplets className="w-5 h-5 text-cyan-600" />;
      case 'request_bill':
        return <Receipt className="w-5 h-5 text-amber-600" />;
      case 'extra_cutlery':
        return <Utensils className="w-5 h-5 text-purple-600" />;
      case 'clean_table':
        return <Sparkles className="w-5 h-5 text-emerald-600" />;
      default:
        return <HelpCircle className="w-5 h-5 text-slate-600" />;
    }
  };

  const getServiceTypeLabel = (type: ServiceRequest['type']) => {
    switch (type) {
      case 'call_waiter':
        return 'Call Waiter Assistance';
      case 'need_water':
        return 'Refill Drinking Water';
      case 'request_bill':
        return 'Customer Requests Bill';
      case 'extra_cutlery':
        return 'Extra Cutlery / Napkins';
      case 'clean_table':
        return 'Clean / Clear Table';
      default:
        return 'Customer Inquiries';
    }
  };

  const getElapsedMinutes = (dateStr: string) => {
    const elapsed = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60));
    return Math.max(1, elapsed);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-900">Staff Service Desk & Call Bells</h2>
            <p className="text-xs text-slate-500">Instant table notifications, waiter calls, refills, and physical bill requests</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">Live Queue:</span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            {openCount} Pending Calls
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold text-base">
            {openCount}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Open Attention Required</p>
            <p className="text-base font-semibold text-slate-900">{openCount} Tables</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-base">
            {ackCount}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Staff En Route</p>
            <p className="text-base font-semibold text-slate-900">{ackCount} Acknowledged</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-base">
            {resolvedCount}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Completed Today</p>
            <p className="text-base font-semibold text-slate-900">{resolvedCount} Requests</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-fit">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filterStatus === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Requests ({serviceRequests.length})
        </button>
        <button
          onClick={() => setFilterStatus('open')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filterStatus === 'open'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Open ({openCount})
        </button>
        <button
          onClick={() => setFilterStatus('acknowledged')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filterStatus === 'acknowledged'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          In Progress ({ackCount})
        </button>
        <button
          onClick={() => setFilterStatus('resolved')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filterStatus === 'resolved'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Resolved ({resolvedCount})
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
            <h4 className="font-semibold text-slate-700 text-base">All clear! No active service requests.</h4>
            <p className="text-xs text-slate-500 mt-1">Guests will appear here in real-time when they tap the table call bell button.</p>
          </div>
        ) : (
          filteredRequests.map(req => {
            const elapsed = getElapsedMinutes(req.createdAt);
            const isUrgent = elapsed >= 5 && req.status === 'open';

            return (
              <div
                key={req.id}
                className={`bg-white rounded-xl border p-4 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isUrgent
                    ? 'border-rose-300 ring-2 ring-rose-100'
                    : req.status === 'open'
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Left table info & request type */}
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 font-bold text-slate-900 text-base border border-slate-200">
                    {req.tableNumber}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-slate-100">{getServiceTypeIcon(req.type)}</div>
                      <span className="font-semibold text-sm text-slate-900">{getServiceTypeLabel(req.type)}</span>
                      {req.status === 'open' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Active Alert
                        </span>
                      )}
                      {req.status === 'acknowledged' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Staff En Route
                        </span>
                      )}
                      {req.status === 'resolved' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Resolved
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>Area: <strong className="text-slate-700">{req.areaName}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{elapsed}m ago ({new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                      </span>
                    </div>

                    {req.customMessage && (
                      <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 mt-2 inline-block font-medium">
                        "{req.customMessage}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {req.status === 'open' && (
                    <button
                      onClick={() => acknowledgeServiceRequest(req.id)}
                      className="px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold border border-indigo-200 transition cursor-pointer"
                    >
                      Acknowledge (I'm on it)
                    </button>
                  )}

                  {req.status !== 'resolved' && (
                    <button
                      onClick={() => resolveServiceRequest(req.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shadow-sm transition cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Mark Resolved</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
