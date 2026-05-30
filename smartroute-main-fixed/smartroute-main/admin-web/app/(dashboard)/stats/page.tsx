'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  delivered:        '#16a34a',
  pending:          '#ca8a04',
  picked_up:        '#2563eb',
  queued:           '#7c3aed',
  escalated:        '#dc2626',
  failed_pickup:    '#ef4444',
  failed_delivery:  '#f87171',
  return_to_sender: '#ea580c',
  returned:         '#6b7280',
};

export default function StatsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, vehiclesRes] = await Promise.all([
        api.get('/admin/orders'),
        api.get('/admin/fleet'),
      ]);
      setOrders(ordersRes.data);
      setVehicles(vehiclesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Orders by status for pie chart
  const statusData = Object.entries(
    orders.reduce((acc: Record<string, number>, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: name.replace('_', ' '), value, key: name }));

  // Orders per day for bar chart
  const dailyData = Object.entries(
    orders.reduce((acc: Record<string, number>, o) => {
      const day = new Date(o.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {})
  ).slice(-7).map(([date, count]) => ({ date, count }));

  // Vehicle utilization
  const vehicleData = vehicles.map(v => ({
    name: v.users?.name?.split(' ')[0] || `V${v.id.slice(0, 4)}`,
    status: v.status,
    capacity: v.capacity,
  }));

  const totalOrders = orders.length;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const successRate = totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 0;
  const activeVehicles = vehicles.filter(v => v.status === 'active').length;
  const liveInjections = orders.filter(o => o.is_live_injection).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Stats</h1>
        <p className="text-sm text-gray-500 mt-0.5">Performance overview</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Orders',     value: totalOrders,    color: 'text-blue-600' },
          { label: 'Delivered',        value: delivered,      color: 'text-green-600' },
          { label: 'Success Rate',     value: `${successRate}%`, color: 'text-green-600' },
          { label: 'Live Injections',  value: liveInjections, color: 'text-purple-600' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Orders per day */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Orders per Day</p>
          {dailyData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Orders by status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Orders by Status</p>
          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.key] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Vehicle utilization */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Vehicle Fleet</p>
        <div className="grid grid-cols-4 gap-3">
          {vehicleData.map((v, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3 text-center">
              <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold
                ${v.status === 'active' ? 'bg-blue-500' : 'bg-gray-300'}`}>
                {v.name[0]}
              </div>
              <p className="text-sm font-medium text-gray-700">{v.name}</p>
              <p className={`text-xs mt-0.5 ${v.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                {v.status}
              </p>
              <p className="text-xs text-gray-400">Cap: {v.capacity}</p>
            </div>
          ))}
          {vehicleData.length === 0 && (
            <div className="col-span-4 text-center text-gray-400 text-sm py-8">No vehicles</div>
          )}
        </div>
      </div>
    </div>
  );
}