'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Order } from '@/types';
import { ArrowLeft, MapPin, Package, CheckCircle, Clock, Truck, AlertTriangle, Navigation, Printer } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:          { label: 'Pending',         color: 'bg-yellow-100 text-yellow-700' },
  picked_up:        { label: 'Picked Up',       color: 'bg-blue-100 text-blue-700' },
  delivered:        { label: 'Delivered',       color: 'bg-green-100 text-green-700' },
  failed_pickup:    { label: 'Pickup Failed',   color: 'bg-red-100 text-red-700' },
  failed_delivery:  { label: 'Delivery Failed', color: 'bg-red-100 text-red-700' },
  escalated:        { label: 'Escalated',       color: 'bg-red-200 text-red-800' },
  return_to_sender: { label: 'Returning',       color: 'bg-orange-100 text-orange-700' },
  returned:         { label: 'Returned',        color: 'bg-gray-100 text-gray-600' },
  queued:           { label: 'Queued',          color: 'bg-purple-100 text-purple-700' },
};

const TIMELINE = [
  { key: 'created',   label: 'Order Created',  icon: Package,       dateKey: 'created_at' },
  { key: 'picked_up', label: 'Picked Up',      icon: Truck,         dateKey: 'picked_up_at' },
  { key: 'delivered', label: 'Delivered',      icon: CheckCircle,   dateKey: 'delivered_at' },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d?: string) => d
    ? new Date(d).toLocaleString('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const getTimelineStatus = (key: string) => {
    if (!order) return 'pending';
    if (key === 'created') return 'done';
    if (key === 'picked_up') return order.picked_up_at ? 'done' : order.status === 'pending' || order.status === 'queued' ? 'pending' : 'active';
    if (key === 'delivered') return order.delivered_at ? 'done' : 'pending';
    return 'pending';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!order) return (
    <div className="text-center py-16 text-gray-400">Order not found</div>
  );

  const statusConfig = STATUS_CONFIG[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order Detail</h1>
          <p className="font-mono text-xs text-gray-400">{order.id}</p>
        </div>
      </div>

      {/* OTP Card */}
      <div className="bg-blue-600 rounded-2xl p-6 mb-4 text-white">
        <p className="text-blue-200 text-sm mb-2">Your Pickup OTP</p>
        <p className="text-5xl font-bold font-mono tracking-widest mb-2">{order.pickup_otp}</p>
        <p className="text-blue-200 text-xs">Tell this code to the driver when they arrive</p>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700">Status</p>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {TIMELINE.map(({ key, label, icon: Icon, dateKey }) => {
            const status = getTimelineStatus(key);
            const date = formatDate(order[dateKey as keyof Order] as string);
            return (
              <div key={key} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${status === 'done' ? 'bg-green-100' : status === 'active' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Icon size={14} className={
                    status === 'done' ? 'text-green-600' :
                    status === 'active' ? 'text-blue-600' : 'text-gray-400'
                  } />
                </div>
                <div>
                  <p className={`text-sm font-medium ${status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>
                    {label}
                  </p>
                  {date && <p className="text-xs text-gray-400 mt-0.5">{date}</p>}
                  {status === 'pending' && <p className="text-xs text-gray-400 mt-0.5">Waiting...</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Addresses */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-4">Delivery Details</p>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <MapPin size={14} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Pickup Address</p>
              <p className="text-sm text-gray-800">{order.pickup_address}</p>
              <p className="text-xs text-gray-400 mt-0.5">{order.pickup_lat}, {order.pickup_lng}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <MapPin size={14} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Delivery Address</p>
              <p className="text-sm text-gray-800">{order.delivery_address}</p>
              <p className="text-xs text-gray-400 mt-0.5">{order.delivery_lat}, {order.delivery_lng}</p>
            </div>
          </div>
          {order.receiver_phone && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Package size={14} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Receiver Phone</p>
                <p className="text-sm text-gray-800">{order.receiver_phone}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Track button */}
      <div className="flex gap-3">
  <button
    onClick={() => router.push(`/orders/${order.id}/sticker`)}
    className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 rounded-xl py-3.5 text-sm font-semibold hover:bg-gray-50 transition"
  >
    <Printer size={16} />
    Print Sticker
  </button>
  {order.assigned_vehicle_id && order.status === 'picked_up' && (
    <button
      onClick={() => router.push(`/track?vehicle_id=${order.assigned_vehicle_id}&order_id=${order.id}`)}
      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-blue-700 transition"
    >
      <Navigation size={16} />
      Track Live
    </button>
  )}
</div>

      {/* Flags */}
      <div className="mt-4 space-y-2">
        {order.is_live_injection && (
          <div className="bg-purple-50 text-purple-700 text-xs px-4 py-2.5 rounded-lg">
            This was a live injected order
          </div>
        )}
        {order.is_return_to_sender && (
          <div className="bg-orange-50 text-orange-700 text-xs px-4 py-2.5 rounded-lg">
            This order is being returned to you
          </div>
        )}
        {order.attempt_count > 0 && (
          <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2">
            <AlertTriangle size={12} />
            {order.attempt_count} delivery attempt{order.attempt_count > 1 ? 's' : ''} failed
          </div>
        )}
      </div>
    </div>
  );
}