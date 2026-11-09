import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { RestaurantTable } from '../../types';
import {
  Table as TableIcon,
  QrCode,
  Users,
  Plus,
  Edit2,
  Trash2,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Layers,
  Share2,
} from 'lucide-react';
import QRCode from 'qrcode';

export const TablesFloorView: React.FC = () => {
  const {
    restaurant,
    areas,
    tables,
    activeLocationId,
    updateTableStatus,
    saveTable,
    deleteTable,
    setActiveTable,
    setViewMode,
  } = useRestaurant();

  if (!restaurant) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#6b6b6b]">
        No restaurant loaded.
      </div>
    );
  }

  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');
  const [selectedTableForQR, setSelectedTableForQR] = useState<RestaurantTable | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isEditingModalOpen, setIsEditingModalOpen] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<Partial<RestaurantTable>>({});

  const filteredTables = tables.filter(t => {
    if (selectedAreaId !== 'all' && t.areaId !== selectedAreaId) return false;
    if (searchTableQuery.trim()) {
      const q = searchTableQuery.toLowerCase();
      return (
        t.tableNumber.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const availableCount = tables.filter(t => t.status === 'available').length;
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  const reservedCount = tables.filter(t => t.status === 'reserved').length;
  const billedCount = tables.filter(t => t.status === 'billed').length;
  const cleaningCount = tables.filter(t => t.status === 'cleaning').length;

  const openQRModal = async (table: RestaurantTable) => {
    setSelectedTableForQR(table);
    // Generate high resolution QR code for table
    const tableUrl = `${window.location.origin}/?table=${table.publicToken}&loc=${activeLocationId}`;
    try {
      const url = await QRCode.toDataURL(tableUrl, {
        width: 360,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(url);
    } catch (err) {
      console.error('Failed to generate QR code', err);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeDataUrl || !selectedTableForQR) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `QR-Table-${selectedTableForQR.tableNumber}-${restaurant.name}.png`;
    a.click();
  };

  const handlePrintQR = () => {
    window.print();
  };

  const handleSaveTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable.tableNumber || !editingTable.name || !editingTable.areaId) return;

    const tableToSave: RestaurantTable = {
      id: editingTable.id || `tbl_${Date.now()}`,
      tableNumber: editingTable.tableNumber,
      name: editingTable.name,
      areaId: editingTable.areaId,
      capacity: Number(editingTable.capacity) || 4,
      status: (editingTable.status as RestaurantTable['status']) || 'available',
      publicToken: editingTable.publicToken || `token_${Math.random().toString(36).substring(2, 9)}`,
      totalOrdersCount: editingTable.totalOrdersCount || 0,
    };

    saveTable(tableToSave);
    setIsEditingModalOpen(false);
  };

  const openAddTable = () => {
    setEditingTable({
      tableNumber: `T-${tables.length + 1}`,
      name: `Table ${tables.length + 1}`,
      areaId: areas[0]?.id || 'area_main',
      capacity: 4,
      status: 'available',
    });
    setIsEditingModalOpen(true);
  };

  const openEditTable = (table: RestaurantTable) => {
    setEditingTable({ ...table });
    setIsEditingModalOpen(true);
  };

  const simulateCustomerScan = (table: RestaurantTable) => {
    setActiveTable(table);
    setViewMode('customer');
  };

  const getStatusBadge = (status: RestaurantTable['status']) => {
    switch (status) {
      case 'available':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Available</span>;
      case 'occupied':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Occupied</span>;
      case 'reserved':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Reserved</span>;
      case 'billed':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Billed</span>;
      case 'cleaning':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Cleaning</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <TableIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-slate-900">Floor Plan & QR Table Management</h2>
              <p className="text-xs text-slate-500">Live seating overview, status tracking, and contactless QR code generation</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddTable}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium text-xs shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Table</span>
          </button>
        </div>
      </div>

      {/* Stats Cluster */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
            {availableCount}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Available</p>
            <p className="text-base font-semibold text-slate-900">{availableCount} Tables</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
            {occupiedCount}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Occupied</p>
            <p className="text-base font-semibold text-slate-900">{occupiedCount} Tables</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-bold">
            {reservedCount}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Reserved</p>
            <p className="text-base font-semibold text-slate-900">{reservedCount} Tables</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold">
            {billedCount}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Billed</p>
            <p className="text-base font-semibold text-slate-900">{billedCount} Tables</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-bold">
            {cleaningCount}
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Needs Cleaning</p>
            <p className="text-base font-semibold text-slate-900">{cleaningCount} Tables</p>
          </div>
        </div>
      </div>

      {/* Filter and Area Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Area Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
          <button
            onClick={() => setSelectedAreaId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              selectedAreaId === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Areas ({tables.length})
          </button>
          {areas.map(area => {
            const count = tables.filter(t => t.areaId === area.id).length;
            return (
              <button
                key={area.id}
                onClick={() => setSelectedAreaId(area.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  selectedAreaId === area.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {area.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search table # or name..."
            value={searchTableQuery}
            onChange={e => setSearchTableQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
          />
        </div>
      </div>

      {/* Table Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.map(table => {
          const area = areas.find(a => a.id === table.areaId);

          return (
            <div
              key={table.id}
              className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-800 text-base">
                      {table.tableNumber}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">{table.name}</h4>
                      <p className="text-xs text-slate-500">{area?.name || 'Dining Area'}</p>
                    </div>
                  </div>
                  {getStatusBadge(table.status)}
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{table.capacity} Seats</span>
                  </div>
                  <span>{table.totalOrdersCount || 0} Total Orders</span>
                </div>
              </div>

              {/* Status Selector & Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500">Change Status:</span>
                  <select
                    value={table.status}
                    onChange={e => updateTableStatus(table.id, e.target.value as RestaurantTable['status'])}
                    className="text-xs font-medium bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                    <option value="billed">Billed</option>
                    <option value="cleaning">Cleaning</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => openQRModal(table)}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition cursor-pointer"
                    title="View & Download QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR</span>
                  </button>

                  <button
                    onClick={() => simulateCustomerScan(table)}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                    title="Simulate Mobile QR Scan"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Test</span>
                  </button>

                  <button
                    onClick={() => openEditTable(table)}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                    title="Edit Table Info"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Code Standee Modal */}
      {selectedTableForQR && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            {/* Standee Branding Card Preview */}
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 bg-slate-50/50">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white mx-auto flex items-center justify-center font-bold shadow-sm">
                <span className="material-symbols-outlined text-xl">restaurant</span>
              </div>
              <h3 className="font-bold text-base text-slate-900 mt-2">{restaurant.name}</h3>
              <p className="text-xs text-slate-500">Scan to Order & Pay from Table</p>

              {/* QR Image */}
              <div className="my-4 p-3 bg-white rounded-xl shadow-sm border border-slate-200 inline-block">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt={`Table ${selectedTableForQR.tableNumber} QR Code`}
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-400">Loading QR...</div>
                )}
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-indigo-900">
                <p className="text-xs font-bold">{selectedTableForQR.name} ({selectedTableForQR.tableNumber})</p>
                <p className="text-[11px] text-indigo-600">Capacity: {selectedTableForQR.capacity} Guests</p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={handleDownloadQR}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </button>
              <button
                onClick={handlePrintQR}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Standee</span>
              </button>
            </div>

            <button
              onClick={() => setSelectedTableForQR(null)}
              className="mt-3 w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Edit / Add Table Modal */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-base text-slate-900 mb-4">
              {editingTable.id ? 'Edit Table Settings' : 'Create New Table'}
            </h3>

            <form onSubmit={handleSaveTableSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Table Number Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-01, VIP-1"
                  value={editingTable.tableNumber || ''}
                  onChange={e => setEditingTable(prev => ({ ...prev, tableNumber: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Table Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Window Corner Table"
                  value={editingTable.name || ''}
                  onChange={e => setEditingTable(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Floor Section</label>
                  <select
                    value={editingTable.areaId || areas[0]?.id}
                    onChange={e => setEditingTable(prev => ({ ...prev, areaId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={editingTable.capacity || 4}
                    onChange={e => setEditingTable(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                {editingTable.id && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this table?')) {
                        deleteTable(editingTable.id!);
                        setIsEditingModalOpen(false);
                      }
                    }}
                    className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition mr-auto cursor-pointer"
                  >
                    Delete Table
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm cursor-pointer"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
