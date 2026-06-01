'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { QueueItem } from '@/types';
import { Clock, RefreshCw, X, Zap } from 'lucide-react';

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await api.get('/queue/');
      setQueue(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const retryInjection = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await api.post(`/queue/${orderId}/retry`);
      showMessage(res.data.message);
      fetchQueue();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Retry failed');
    } finally {
      setActionLoading(null);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Cancel this queued order?')) return;
    setActionLoading(orderId);
    try {
      await api.delete(`/queue/${orderId}`);
      showMessage('Order cancelled');
      fetchQueue();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Cancel failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  // Compute filtered
  const filtered = queue
    .filter(o => !dateFilter || (o.queued_at && o.queued_at.startsWith(dateFilter)))
    .sort((a, b) => {
      const tA = new Date(a.queued_at).getTime();
      const tB = new Date(b.queued_at).getTime();
      return sortOrder === 'desc' ? tB - tA : tA - tB;
    });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Orders waiting for a vehicle</p>
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
          <button
            onClick={fetchQueue}
            className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 ml-2"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 bg-blue-50 text-blue-700 text-sm px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 text-gray-400">
          <Clock size={32} className="mb-2 opacity-50" />
          <p className="text-sm">Queue is empty</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.queue_id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs text-gray-400">{item.order_id.slice(0, 8)}...</span>
                    {item.is_live_injection && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Zap size={10} /> Live
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Pickup</p>
                      <p className="text-gray-700">{item.pickup_address}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Delivery</p>
                      <p className="text-gray-700">{item.delivery_address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Queued: {formatDate(item.queued_at)}</span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      Reason: {item.reason}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => retryInjection(item.order_id)}
                    disabled={actionLoading === item.order_id}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={12} />
                    Retry
                  </button>
                  <button
                    onClick={() => cancelOrder(item.order_id)}
                    disabled={actionLoading === item.order_id}
                    className="flex items-center gap-1.5 text-xs border border-red-200 text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}