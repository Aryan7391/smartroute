'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Vehicle, Stop } from '@/types';
import { Truck, Package, CheckCircle, Circle } from 'lucide-react';

const CITY_LAT = parseFloat(process.env.NEXT_PUBLIC_CITY_LAT || '20.2961');
const CITY_LNG = parseFloat(process.env.NEXT_PUBLIC_CITY_LNG || '85.8245');
const ALERT_RADIUS_KM = 0.5;

const VEHICLE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c',
  '#0891b2', '#db2777', '#ca8a04', '#065f46', '#9f1239',
];

const getVehicleColor = (index: number) => VEHICLE_COLORS[index % VEHICLE_COLORS.length];

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
};

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.error('Audio error', e);
  }
};

export default function LiveMapPage() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLayersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const alertedVehicles = useRef<Set<string>>(new Set());

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);

  // Keep userPos in a ref so fetchVehicles can access latest value
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => { userPosRef.current = userPos; }, [userPos]);

  useEffect(() => {
    initMap();
    fetchVehicles();
    getUserLocation();
    const interval = setInterval(fetchVehicles, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && vehicles.length >= 0) updateVehicleMarkers();
  }, [vehicles, selected]);

  useEffect(() => {
    if (selected) fetchStops(selected.id);
    else clearRoute();
  }, [selected]);

  useEffect(() => {
    if (userPos && mapInstanceRef.current) updateUserMarker();
  }, [userPos]);

  const showToast = (message: string, color: string) => {
    setToast({ message, color });
    setTimeout(() => setToast(null), 5000);
  };

  const initMap = async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([CITY_LAT, CITY_LNG], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  };

  const updateUserMarker = async () => {
    const L = (await import('leaflet')).default;
    const map = mapInstanceRef.current;
    if (!map || !userPos) return;
    if (userMarkerRef.current) userMarkerRef.current.remove();
    const icon = L.divIcon({
      html: `<div style="background:#7c3aed;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(124,58,237,0.25)"></div>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon })
      .addTo(map)
      .bindPopup('<b>Your Location</b>');
  };

  const fetchVehicles = async () => {
    try {
      const res = await api.get('/vehicles/active');
      const data: Vehicle[] = res.data;
      setVehicles(data);

      const pos = userPosRef.current;
      if (pos) {
        // Check proximity for each vehicle
        data.forEach((v, index) => {
          if (!v.current_lat || !v.current_lng) return;
          const dist = haversineKm(pos.lat, pos.lng, v.current_lat, v.current_lng);

          if (dist <= ALERT_RADIUS_KM && !alertedVehicles.current.has(v.id)) {
            alertedVehicles.current.add(v.id);
            playBeep();
            const color = getVehicleColor(index);
            showToast(`Vehicle ${index + 1} is within 500m — prepare your item!`, color);
          }

          // Reset alert if vehicle moves away
          if (dist > ALERT_RADIUS_KM && alertedVehicles.current.has(v.id)) {
            alertedVehicles.current.delete(v.id);
          }
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStops = async (vehicleId: string) => {
    try {
      const res = await api.get(`/vehicles/${vehicleId}/stops`);
      setStops(res.data);
      drawRoute(vehicleId, res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const updateVehicleMarkers = async () => {
    const L = (await import('leaflet')).default;
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    vehicles.forEach((v, index) => {
      if (!v.current_lat || !v.current_lng) return;

      const color = getVehicleColor(index);
      const isSelected = selected?.id === v.id;
      const size = isSelected ? 46 : 36;

      const icon = L.divIcon({
        html: `<div style="
          background:${color};
          width:${size}px;height:${size}px;
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          border:3px solid white;
          box-shadow:0 4px 14px ${color}${isSelected ? 'aa' : '55'};
          cursor:pointer;
        ">
          <svg width="${isSelected ? 20 : 16}" height="${isSelected ? 20 : 16}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <path d="M16 8h4l3 5v3h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([v.current_lat!, v.current_lng!], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;font-size:13px;min-width:150px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="background:${color};width:12px;height:12px;border-radius:50%"></div>
              <b>Vehicle ${index + 1}</b>
            </div>
            <span style="color:#6b7280">${v.users?.name || 'Driver'}</span><br/>
            <span style="color:#16a34a;font-size:12px">● Active</span>
          </div>
        `);

      marker.on('click', () => {
        setSelected(prev => prev?.id === v.id ? null : v);
      });

      markersRef.current.push(marker);
    });
  };

  const drawRoute = async (vehicleId: string, stops: Stop[]) => {
  const L = (await import('leaflet')).default;
  const map = mapInstanceRef.current;
  if (!map) return;

  clearRoute();

  const vehicle = vehicles.find(v => v.id === vehicleId);
  if (!vehicle?.current_lat || !vehicle?.current_lng) return;

  const vehicleIndex = vehicles.findIndex(v => v.id === vehicleId);
  const routeColor = getVehicleColor(vehicleIndex);

  // Draw stop markers
  stops.forEach(stop => {
    const stopColor = stop.type === 'pickup' ? '#16a34a' : '#dc2626';
    const opacity = stop.is_done ? 0.35 : 1;
    const icon = L.divIcon({
      html: `<div style="
        background:${stopColor};
        width:26px;height:26px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:11px;font-weight:bold;
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.2);
        opacity:${opacity}
      ">${stop.sequence}</div>`,
      className: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker([stop.lat, stop.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:sans-serif;font-size:12px">
          <b>${stop.type.toUpperCase()} #${stop.sequence}</b>
          ${stop.is_done ? ' ✓' : ''}<br/>
          ${stop.type === 'pickup' ? stop.orders?.pickup_address || '' : stop.orders?.delivery_address || ''}
        </div>
      `);

    routeLayersRef.current.push(marker);
  });

  // Load segments from DB — no live OSRM call
  try {
    const res = await api.get(`/vehicles/${vehicleId}/segments`);
    const segments = res.data;

    segments.forEach((seg: any) => {
      const color = seg.is_done ? '#9ca3af' : routeColor;
      const opacity = seg.is_done ? 0.35 : 0.75;
      const dashArray = seg.is_done ? '4 4' : '8 4';

      const line = L.geoJSON(seg.geometry, {
        style: { color, weight: 4, opacity, dashArray }
      }).addTo(map);

      routeLayersRef.current.push(line);
    });
  } catch (e) {
    console.error('Segment load error', e);
  }

  // Fit bounds
  const allPoints: [number, number][] = [
    [vehicle.current_lat, vehicle.current_lng],
    ...stops.map(s => [s.lat, s.lng] as [number, number])
  ];
  if (allPoints.length > 0) {
    const bounds = L.latLngBounds(allPoints);
    map.fitBounds(bounds, { padding: [60, 60] });
  }
};

  const clearRoute = async () => {
    routeLayersRef.current.forEach(l => l.remove());
    routeLayersRef.current = [];
    setStops([]);
  };

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3"
          style={{ background: toast.color }}
        >
          <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping"></div>
          <span className="text-sm font-semibold text-white whitespace-nowrap">{toast.message}</span>
        </div>
      )}

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Live Map</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {vehicles.length} active vehicle{vehicles.length !== 1 ? 's' : ''} · updates every 10s
            </p>
          </div>
          <div className="flex items-center gap-3">
            {locating && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                Getting your location...
              </span>
            )}
            {userPos && (
              <span className="text-xs text-purple-600 flex items-center gap-1 font-medium">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                Your location found
              </span>
            )}
            <button
              onClick={() => router.push('/create')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              <Package size={15} />
              Send Item
            </button>
          </div>
        </div>

        <div className="flex gap-4" style={{ height: 'calc(100vh - 160px)' }}>

          {/* Vehicle list */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pb-2">
            {loading ? (
              <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
                <Truck size={24} className="mb-2 opacity-40" />
                No active vehicles
              </div>
            ) : (
              vehicles.map((v, index) => {
                const color = getVehicleColor(index);
                const isSelected = selected?.id === v.id;
                const isNearby = userPos && v.current_lat && v.current_lng &&
                  haversineKm(userPos.lat, userPos.lng, v.current_lat, v.current_lng) <= ALERT_RADIUS_KM;

                return (
                  <div
                    key={v.id}
                    onClick={() => setSelected(prev => prev?.id === v.id ? null : v)}
                    className="bg-white rounded-xl border-2 cursor-pointer transition-all overflow-hidden"
                    style={{ borderColor: isSelected ? color : '#e5e7eb' }}
                  >
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ background: isSelected ? `${color}11` : 'transparent' }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: color }}
                        >
                          <Truck size={14} className="text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Vehicle {index + 1}</p>
                          <p className="text-xs text-gray-400">{v.users?.name || 'Driver'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                        {isNearby && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white animate-pulse"
                            style={{ background: color }}>
                            Nearby
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && stops.length > 0 && (
                      <div className="px-4 pb-3 pt-1 border-t border-gray-100">
                        <p className="text-xs text-gray-400 mb-2">{stops.length} stops remaining</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {stops.map(s => (
                            <div key={s.id} className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                style={{ background: s.type === 'pickup' ? '#16a34a' : '#dc2626' }}
                              >
                                {s.sequence}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-600 capitalize">{s.type}</p>
                                <p className="text-xs text-gray-400 truncate">
                                  {s.type === 'pickup' ? s.orders?.pickup_address : s.orders?.delivery_address}
                                </p>
                              </div>
                              {s.is_done
                                ? <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                                : <Circle size={12} className="text-gray-300 flex-shrink-0" />
                              }
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); router.push('/create'); }}
                          className="mt-3 w-full text-xs text-white py-2 rounded-lg font-medium transition flex items-center justify-center gap-1 hover:opacity-90"
                          style={{ background: color }}
                        >
                          <Package size={12} />
                          Send with this vehicle
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Legend */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-500 mb-2">Legend</p>
              <div className="space-y-1.5">
                {vehicles.slice(0, 5).map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getVehicleColor(i) }}></div>
                    Vehicle {i + 1}
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-1.5 mt-1.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                    Pickup stop
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></div>
                    Delivery stop
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-purple-500 flex-shrink-0"></div>
                    Your location
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden relative">
            {vehicles.length === 0 && !loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 text-center shadow-sm">
                  <Truck size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No active vehicles right now</p>
                  <p className="text-xs text-gray-400 mt-1">Check back soon</p>
                </div>
              </div>
            )}
            {!selected && vehicles.length > 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-white border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-500 shadow-sm whitespace-nowrap">
                  Click a vehicle to see its route
                </div>
              </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
          </div>
        </div>
      </div>
    </>
  );
}