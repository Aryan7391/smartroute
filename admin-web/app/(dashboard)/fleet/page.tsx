'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Vehicle, Stop } from '@/types';
import { Truck, MapPin, CheckCircle, Circle } from 'lucide-react';

const VEHICLE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c',
  '#0891b2', '#db2777', '#ca8a04', '#065f46', '#9f1239',
];

const getVehicleColor = (index: number) => VEHICLE_COLORS[index % VEHICLE_COLORS.length];

function FleetContent() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLayersRef = useRef<any[]>([]);
  
  const searchParams = useSearchParams();
  const initialVehicleId = searchParams.get('vehicle_id');
  const initialSelectRef = useRef(false);

  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    initMap();
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && vehicles.length >= 0) updateMapMarkers();
    
    // Auto-select from URL parameter on first load
    if (vehicles.length > 0 && initialVehicleId && !initialSelectRef.current) {
      const v = vehicles.find(v => v.id === initialVehicleId);
      if (v) {
        setSelected(v);
        initialSelectRef.current = true;
      }
    }
  }, [vehicles, selected]);

  useEffect(() => {
    if (selected) fetchStops(selected.id);
    else clearRoute();
  }, [selected]);

  const initMap = async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');
    if (mapInstanceRef.current) return;
    const cityLat = parseFloat(process.env.NEXT_PUBLIC_CITY_LAT || '20.2961');
    const cityLng = parseFloat(process.env.NEXT_PUBLIC_CITY_LNG || '85.8245');
    const map = L.map(mapRef.current, { zoomControl: false }).setView([cityLat, cityLng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;
  };

  const fetchVehicles = async () => {
    try {
      const res = await api.get('/admin/fleet');
      setVehicles(res.data);
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
      await drawRoute(vehicleId, res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const updateMapMarkers = async () => {
    const L = (await import('leaflet')).default;
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    vehicles.forEach((v, index) => {
      if (!v.current_lat || !v.current_lng) return;

      const color = v.status === 'active' ? getVehicleColor(index) : '#9ca3af';
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

      const marker = L.marker([v.current_lat, v.current_lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;font-size:13px;min-width:150px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="background:${color};width:12px;height:12px;border-radius:50%"></div>
              <b>Vehicle ${index + 1} <span style="color:#6b7280;font-size:11px">(${v.id.substring(0, 8).toUpperCase()})</span></b>
            </div>
            Driver: ${v.users?.name || 'Unknown'}<br/>
            Status: <span style="color:${color}">${v.status}</span><br/>
            Capacity: ${v.capacity}
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

  // Draw dynamic live route to the next stop
  const nextStop = stops.find(s => !s.is_done);
  if (nextStop && vehicle.current_lat && vehicle.current_lng) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${vehicle.current_lng},${vehicle.current_lat};${nextStop.lng},${nextStop.lat}?overview=full&geometries=geojson`;
      const routeRes = await fetch(url);
      const routeData = await routeRes.json();
      if (routeData.routes && routeData.routes.length > 0) {
        const liveLine = L.geoJSON(routeData.routes[0].geometry, {
          style: { color: routeColor, weight: 5, opacity: 0.9, dashArray: '10 8' }
        }).addTo(map);
        routeLayersRef.current.push(liveLine);
      }
    } catch (err) {
      console.warn("Could not fetch live OSRM route to next stop", err);
    }
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
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Fleet</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live vehicle positions and routes</p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">

        {/* Vehicle list */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">{vehicles.length} Vehicles</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="p-4 text-sm text-gray-400 text-center">No vehicles found</div>
          ) : (
            vehicles.map((v, index) => {
              const color = v.status === 'active' ? getVehicleColor(index) : '#9ca3af';
              const isSelected = selected?.id === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelected(isSelected ? null : v)}
                  className="cursor-pointer transition-all border-b border-gray-100 last:border-0"
                  style={{
                    borderLeft: isSelected ? `4px solid ${color}` : '4px solid transparent',
                    background: isSelected ? `${color}0d` : 'transparent',
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: color }}
                        >
                          <Truck size={13} className="text-white" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            Vehicle {index + 1} <span className="text-gray-500 text-xs">({v.id.substring(0, 8).toUpperCase()})</span>
                          </span>
                          <p className="text-xs text-gray-400">{v.users?.name || 'Unknown Driver'}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <MapPin size={11} />
                      <span>{v.current_lat ? `${v.current_lat.toFixed(4)}, ${v.current_lng?.toFixed(4)}` : 'No location'}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">Capacity: {v.capacity}</div>

                    {/* Stops when selected */}
                    {isSelected && stops.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs font-semibold text-gray-500">{stops.length} stops remaining</p>
                        {stops.map(s => (
                          <div key={s.id} className="flex items-center gap-2 text-xs text-gray-600">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ background: s.type === 'pickup' ? '#16a34a' : '#dc2626' }}
                            >
                              {s.sequence}
                            </div>
                            <span className="capitalize flex-1 truncate">{s.type}</span>
                            {s.is_done
                              ? <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                              : <Circle size={12} className="text-gray-300 flex-shrink-0" />
                            }
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Legend */}
          {vehicles.length > 0 && (
            <div className="p-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Vehicle Colors</p>
              <div className="space-y-1.5">
                {vehicles.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: v.status === 'active' ? getVehicleColor(i) : '#9ca3af' }}
                    ></div>
                    Vehicle {i + 1} — {v.users?.name || 'Unknown'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden relative">
          {!selected && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-500 shadow-sm whitespace-nowrap">
              Click a vehicle to see its route
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}

export default function FleetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading map...</div>}>
      <FleetContent />
    </Suspense>
  );
}