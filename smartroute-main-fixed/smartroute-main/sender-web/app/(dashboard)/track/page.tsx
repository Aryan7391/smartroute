'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Vehicle } from '@/types';
import { ArrowLeft, MapPin, Truck, Navigation } from 'lucide-react';

export default function TrackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const vehicle_id = searchParams.get('vehicle_id');
  const order_id = searchParams.get('order_id');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (!vehicle_id) return;
    fetchVehicle();
    const interval = setInterval(fetchVehicle, 5000);
    return () => clearInterval(interval);
  }, [vehicle_id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    initMap();
  }, []);

  useEffect(() => {
    if (vehicle && mapInstanceRef.current) updateDriverMarker();
  }, [vehicle]);

  const initMap = async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current).setView([12.9716, 77.5946], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    mapInstanceRef.current = map;
  };

  const fetchVehicle = async () => {
    try {
      const res = await api.get(`/vehicles/${vehicle_id}`);
      setVehicle(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const updateDriverMarker = async () => {
    const L = (await import('leaflet')).default;
    const map = mapInstanceRef.current;
    if (!map || !vehicle?.current_lat || !vehicle?.current_lng) return;

    if (driverMarkerRef.current) driverMarkerRef.current.remove();

    const icon = L.divIcon({
      html: `<div style="background:#2563eb;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 12px rgba(37,99,235,0.4)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      </div>`,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const marker = L.marker([vehicle.current_lat, vehicle.current_lng], { icon })
      .addTo(map)
      .bindPopup('<b>Your Driver</b><br/>On the way to you');

    driverMarkerRef.current = marker;
    map.panTo([vehicle.current_lat, vehicle.current_lng]);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Live Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">Driver location updates every 5 seconds</p>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <Truck size={15} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Driver is on the way</p>
            {vehicle?.current_lat && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Navigation size={10} />
                {vehicle.current_lat.toFixed(4)}, {vehicle.current_lng?.toFixed(4)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-600 font-medium">Live</span>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: '500px' }}>
        <div ref={mapRef} className="w-full h-full" />
      </div>
    </div>
  );
}