'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Order } from '@/types';
import { Package, Search, Filter, MapPin } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending:          'bg-yellow-100 text-yellow-700',
  picked_up:        'bg-blue-100 text-blue-700',
  delivered:        'bg-green-100 text-green-700',
  failed_pickup:    'bg-red-100 text-red-700',
  failed_delivery:  'bg-red-100 text-red-700',
  escalated:        'bg-red-200 text-red-800',
  return_to_sender: 'bg-orange-100 text-orange-700',
  returned:         'bg-gray-100 text-gray-600',
  queued:           'bg-purple-100 text-purple-700',
};

const STATUSES = ['all', 'pending', 'picked_up', 'delivered', 'failed_pickup', 'failed_delivery', 'escalated', 'queued', 'return_to_sender'];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filtered, setFiltered] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Order | null>(null);

  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    let result = [...orders];
    if (statusFilter !== 'all') result = result.filter(o => o.status === statusFilter);
    if (search) result = result.filter(o =>
      o.pickup_address.toLowerCase().includes(search.toLowerCase()) ||
      o.delivery_address.toLowerCase().includes(search.toLowerCase()) ||
      o.id.includes(search)
    );
    if (dateFilter) {
      result = result.filter(o => o.created_at && o.created_at.startsWith(dateFilter));
    }
    result.sort((a, b) => {
      const tA = new Date(a.created_at).getTime();
      const tB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? tB - tA : tA - tB;
    });
    setFiltered(result);
  }, [orders, statusFilter, search, dateFilter, sortOrder]);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/admin/orders');
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleString() : '—';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">All orders across the system</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by address or order ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 flex items-center gap-1"
            >
              Sort: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={15} className="text-gray-400" />
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors capitalize
                ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s === 'all' ? `All (${orders.length})` : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Package size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No orders found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Order ID</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Pickup</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Delivery</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Attempts</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(selected?.id === o.id ? null : o)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors
                      ${selected?.id === o.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{o.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[160px] truncate">{o.pickup_address}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[160px] truncate">{o.delivery_address}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">{o.attempt_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-4 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Order Detail</p>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs">Close</button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Order ID</p>
                <p className="font-mono text-xs text-gray-600 break-all">{selected.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Status</p>
                <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[selected.status]}`}>
                  {selected.status.replace('_', ' ')}
                </span>
              </div>
              {selected.escalation_reason && (
                <div>
                  <p className="text-xs text-red-500 mb-0.5 font-medium">Escalation Reason</p>
                  <p className="text-red-700 text-xs bg-red-50 p-2 rounded-lg border border-red-100">{selected.escalation_reason}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Pickup</p>
                <p className="text-gray-700">{selected.pickup_address}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Delivery</p>
                <p className="text-gray-700">{selected.delivery_address}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Pickup OTP</p>
                <p className="font-mono font-bold text-gray-900">{selected.pickup_otp}</p>
              </div>
              {selected.delivery_otp && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Delivery OTP</p>
                  <p className="font-mono font-bold text-gray-900">{selected.delivery_otp}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Receiver Phone</p>
                <p className="text-gray-700">{selected.receiver_phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Attempt Count</p>
                <p className="text-gray-700">{selected.attempt_count}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Created</p>
                <p className="text-gray-700">{formatDate(selected.created_at)}</p>
              </div>
              {selected.picked_up_at && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Picked Up</p>
                  <p className="text-gray-700">{formatDate(selected.picked_up_at)}</p>
                </div>
              )}
              {selected.delivered_at && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Delivered</p>
                  <p className="text-gray-700">{formatDate(selected.delivered_at)}</p>
                </div>
              )}
              {selected.is_live_injection && (
                <div className="bg-purple-50 text-purple-700 text-xs px-3 py-2 rounded-lg">
                  Live injected order
                </div>
              )}
              {selected.is_return_to_sender && (
                <div className="bg-orange-50 text-orange-700 text-xs px-3 py-2 rounded-lg">
                  Return to sender
                </div>
              )}
              
              {selected.assigned_vehicle_id && (selected.status === 'pending' || selected.status === 'picked_up') && (
                <button
                  onClick={() => router.push(`/fleet?vehicle_id=${selected.assigned_vehicle_id}`)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 transition mt-2"
                >
                  <MapPin size={14} />
                  Track Vehicle
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}