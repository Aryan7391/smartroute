'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Order } from '@/types';
import { Package, MapPin, Clock, CheckCircle, XCircle, AlertTriangle, Plus, Eye } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:          { label: 'Pending',          color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  picked_up:        { label: 'Picked Up',        color: 'bg-blue-100 text-blue-700',    icon: Package },
  delivered:        { label: 'Delivered',        color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  failed_pickup:    { label: 'Pickup Failed',    color: 'bg-red-100 text-red-700',      icon: XCircle },
  failed_delivery:  { label: 'Delivery Failed',  color: 'bg-red-100 text-red-700',      icon: XCircle },
  escalated:        { label: 'Escalated',        color: 'bg-red-200 text-red-800',      icon: AlertTriangle },
  return_to_sender: { label: 'Returning',        color: 'bg-orange-100 text-orange-700',icon: Package },
  returned:         { label: 'Returned',         color: 'bg-gray-100 text-gray-600',    icon: CheckCircle },
  queued:           { label: 'Queued',           color: 'bg-purple-100 text-purple-700',icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: Clock };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${config.color}`}>
      <Icon size={11} />
      {config.label}
    </span>
  );
}

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-mono text-xs text-gray-400 mb-1">{order.id.slice(0, 8)}...</p>
          <StatusBadge status={order.status} />
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
          {order.is_live_injection && (
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full mt-1 inline-block">
              Live injected
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5 flex-shrink-0">
            <MapPin size={10} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Pickup</p>
            <p className="text-sm text-gray-700">{order.pickup_address}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5 flex-shrink-0">
            <MapPin size={10} className="text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Delivery</p>
            <p className="text-sm text-gray-700">{order.delivery_address}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">OTP</span>
          <span className="font-mono font-bold text-gray-900 text-sm">{order.pickup_otp}</span>
        </div>
        <button
          onClick={onClick}
          className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:text-blue-700"
        >
          <Eye size={13} />
          View details
        </button>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders/my');
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const tabs = [
    { key: 'all',       label: `All (${orders.length})` },
    { key: 'pending',   label: 'Pending' },
    { key: 'picked_up', label: 'In Transit' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'queued',    label: 'Queued' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all your deliveries</p>
        </div>
        <button
          onClick={() => router.push('/create')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          New Order
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${filter === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-48 text-gray-400">
          <Package size={32} className="mb-2 opacity-50" />
          <p className="text-sm">No orders found</p>
          <button
            onClick={() => router.push('/create')}
            className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-700"
          >
            Create your first order
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={() => router.push(`/orders/${order.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}