'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Truck, Package, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Stats {
  total_vehicles: number;
  active_vehicles: number;
  idle_vehicles: number;
  total_orders: number;
  delivered: number;
  pending: number;
  queued: number;
  escalated: number;
  failed: number;
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats>({
    total_vehicles: 0, active_vehicles: 0, idle_vehicles: 0,
    total_orders: 0, delivered: 0, pending: 0,
    queued: 0, escalated: 0, failed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const [vehiclesRes, ordersRes, queueRes] = await Promise.all([
        api.get('/admin/fleet'),
        api.get('/admin/orders'),
        api.get('/queue/'),
      ]);

      const vehicles = vehiclesRes.data;
      const orders = ordersRes.data;
      const queue = queueRes.data;

      setStats({
        total_vehicles:  vehicles.length,
        active_vehicles: vehicles.filter((v: any) => v.status === 'active').length,
        idle_vehicles:   vehicles.filter((v: any) => v.status === 'idle').length,
        total_orders:    orders.length,
        delivered:       orders.filter((o: any) => o.status === 'delivered').length,
        pending:         orders.filter((o: any) => o.status === 'pending' || o.status === 'picked_up').length,
        queued:          queue.length,
        escalated:       orders.filter((o: any) => o.status === 'escalated').length,
        failed:          orders.filter((o: any) => o.status === 'failed_pickup' || o.status === 'failed_delivery').length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live snapshot of your fleet and orders</p>
      </div>

      {/* Vehicle stats */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Fleet</p>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Vehicles"  value={stats.total_vehicles}  icon={Truck}         color="bg-blue-500" />
        <StatCard label="Active"          value={stats.active_vehicles} icon={Truck}         color="bg-green-500" />
        <StatCard label="Idle"            value={stats.idle_vehicles}   icon={Truck}         color="bg-gray-400" />
      </div>

      {/* Order stats */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Orders</p>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Orders"  value={stats.total_orders} icon={Package}       color="bg-blue-500" />
        <StatCard label="Delivered"     value={stats.delivered}    icon={CheckCircle}   color="bg-green-500" />
        <StatCard label="In Progress"   value={stats.pending}      icon={Package}       color="bg-yellow-500" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Queued"     value={stats.queued}    icon={Clock}          color="bg-orange-500" />
        <StatCard label="Escalated"  value={stats.escalated} icon={AlertTriangle}  color="bg-red-500" />
        <StatCard label="Failed"     value={stats.failed}    icon={XCircle}        color="bg-red-400" />
      </div>
    </div>
  );
}