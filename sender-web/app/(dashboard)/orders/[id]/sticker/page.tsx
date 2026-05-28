'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Order } from '@/types';
import { ArrowLeft, Printer } from 'lucide-react';

export default function StickerPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
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

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!order) return (
    <div className="text-center py-16 text-gray-400">Order not found</div>
  );

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area {
            width: 100mm;
            margin: 0 auto;
            padding: 0;
          }
          body { background: white; }
          @page { size: A5; margin: 10mm; }
        }
      `}</style>

      {/* Controls — hidden on print */}
      <div className="no-print max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Delivery Sticker</h1>
              <p className="text-sm text-gray-500 mt-0.5">Print and attach to your item</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Printer size={16} />
            Print Sticker
          </button>
        </div>
      </div>

      {/* Sticker — this gets printed */}
      <div className="print-area max-w-sm mx-auto">
        <div className="border-2 border-gray-900 rounded-lg overflow-hidden font-mono">

          {/* Header */}
          <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">SMARTROUTE DELIVERY</p>
              <p className="text-lg font-bold tracking-widest">#{order.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Date</p>
              <p className="text-xs">{new Date(order.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}</p>
            </div>
          </div>

          {/* From */}
          <div className="px-4 py-3 border-b-2 border-dashed border-gray-300">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">F</span>
              </div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">From (Sender)</p>
            </div>
            <p className="text-sm font-bold text-gray-900 leading-snug">{order.pickup_address}</p>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center py-2 bg-gray-50">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="h-px w-16 bg-gray-300"></div>
              <span className="text-lg">↓</span>
              <div className="h-px w-16 bg-gray-300"></div>
            </div>
          </div>

          {/* To */}
          <div className="px-4 py-3 border-t-2 border-dashed border-gray-300">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">T</span>
              </div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">To (Receiver)</p>
            </div>
            <p className="text-sm font-bold text-gray-900 leading-snug">{order.delivery_address}</p>
            <div className="mt-2 flex items-center gap-4">
              {order.receiver_name && (
                <div>
                  <p className="text-xs text-gray-400">Name</p>
                  <p className="text-sm font-bold text-gray-900">{order.receiver_name}</p>
                </div>
              )}
              {order.receiver_phone && (
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="text-sm font-bold text-gray-900">{order.receiver_phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* OTP section */}
          <div className="bg-blue-600 px-4 py-3">
            <p className="text-xs text-blue-200 mb-1">PICKUP OTP — Tell this to driver</p>
            <p className="text-3xl font-bold text-white tracking-widest">{order.pickup_otp}</p>
          </div>

          {/* Driver verification box */}
          <div className="px-4 py-3 border-t-2 border-dashed border-gray-300">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Driver Verification</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-gray-300 rounded p-2">
                <p className="text-xs text-gray-400">Address checked</p>
                <div className="mt-1 h-5 border-b border-gray-300"></div>
              </div>
              <div className="border border-gray-300 rounded p-2">
                <p className="text-xs text-gray-400">OTP verified</p>
                <div className="mt-1 h-5 border-b border-gray-300"></div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
            <p className="text-xs text-gray-400">smartroute.app</p>
            <p className="text-xs text-gray-400">{order.id.slice(0, 16)}</p>
          </div>

        </div>

        {/* Instructions — hidden on print */}
        <div className="no-print mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800 mb-2">Before handing over to driver:</p>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>✓ Print this sticker and attach it to the item</li>
            <li>✓ Make sure both addresses are clearly visible</li>
            <li>✓ Remember your OTP — tell it verbally to the driver</li>
            <li>✓ Driver will verify the sticker before accepting</li>
          </ul>
        </div>
      </div>
    </>
  );
}