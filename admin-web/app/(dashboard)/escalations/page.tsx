'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Order } from '@/types';
import { AlertTriangle, RotateCcw, ArrowLeftCircle, CreditCard, Phone } from 'lucide-react';

export default function EscalationsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchEscalated();
  }, []);

  const fetchEscalated = async () => {
    try {
      const res = await api.get('/admin/orders/escalated');
      setOrders(res.data);
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

  const reschedule = async (orderId: string) => {
    setActionLoading(orderId + '_reschedule');
    try {
      const res = await api.post(`/admin/orders/${orderId}/reschedule`);
      showMessage(res.data.message);
      fetchEscalated();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const returnToSender = async (orderId: string) => {
    if (!confirm('Mark this order for return to sender?')) return;
    setActionLoading(orderId + '_return');
    try {
      const res = await api.patch(`/orders/${orderId}/return-to-sender`);
      showMessage(res.data.message);
      fetchEscalated();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const chargeExtra = async (orderId: string) => {
    setActionLoading(orderId + '_charge');
    try {
      const res = await api.post(`/admin/orders/${orderId}/charge-extra`);
      showMessage(res.data.message);
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleString() : '—';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Escalations</h1>
        <p className="text-sm text-gray-500 mt-0.5">Orders that failed twice and need manual action</p>
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
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 text-gray-400">
          <AlertTriangle size={32} className="mb-2 opacity-50" />
          <p className="text-sm">No escalations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-red-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={16} className="text-red-500" />
                    <span className="font-mono text-xs text-gray-400">{order.id.slice(0, 8)}...</span>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      {order.attempt_count} attempts failed
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Pickup</p>
                      <p className="text-gray-700">{order.pickup_address}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Delivery</p>
                      <p className="text-gray-700">{order.delivery_address}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Receiver Phone</p>
                      <p className="text-gray-700 flex items-center gap-1">
                        <Phone size={12} />
                        {order.receiver_phone || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Created</p>
                      <p className="text-gray-700">{formatDate(order.created_at)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => reschedule(order.id)}
                    disabled={actionLoading === order.id + '_reschedule'}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw size={12} />
                    Reschedule
                  </button>
                  <button
                    onClick={() => returnToSender(order.id)}
                    disabled={actionLoading === order.id + '_return'}
                    className="flex items-center gap-1.5 text-xs border border-orange-200 text-orange-600 px-3 py-2 rounded-lg hover:bg-orange-50 disabled:opacity-50 transition-colors"
                  >
                    <ArrowLeftCircle size={12} />
                    Return to Sender
                  </button>
                  <button
                    onClick={() => chargeExtra(order.id)}
                    disabled={actionLoading === order.id + '_charge'}
                    className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    <CreditCard size={12} />
                    Charge Extra
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