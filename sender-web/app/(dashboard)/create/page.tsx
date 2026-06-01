'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, MapPin, Phone, Package, Crosshair, User, Search, X, Check, ChevronRight } from 'lucide-react';

interface LatLng { lat: number; lng: number; }
interface SearchResult { display_name: string; lat: string; lon: string; }

const CITY_LAT     = parseFloat(process.env.NEXT_PUBLIC_CITY_LAT     || '20.2961');
const CITY_LNG     = parseFloat(process.env.NEXT_PUBLIC_CITY_LNG     || '85.8245');
const CITY_VIEWBOX = process.env.NEXT_PUBLIC_CITY_VIEWBOX            || '85.7,20.1,86.0,20.5';
const CITY_NAME    = process.env.NEXT_PUBLIC_CITY_NAME               || 'Bhubaneswar';
const CITY_COUNTRY = process.env.NEXT_PUBLIC_CITY_COUNTRY            || 'in';

// ─── Full screen map modal ───────────────────────────────────────────────────
function MapModal({
  open,
  color,
  title,
  initialPos,
  onConfirm,
  onClose,
}: {
  open: boolean;
  color: 'green' | 'red';
  title: string;
  initialPos: LatLng | null;
  onConfirm: (pos: LatLng, address: string) => void;
  onClose: () => void;
}) {
  const mapRef         = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef      = useRef<any>(null);
  const [pos, setPos]           = useState<LatLng | null>(initialPos);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [locating, setLocating] = useState(false);
  const [address, setAddress]   = useState('');
  const timerRef = useRef<any>(null);
  const pinColor = color === 'green' ? '#16a34a' : '#dc2626';

  useEffect(() => {
    if (!open) return;
    setTimeout(() => initMap(), 100);
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [open]);

  const initMap = async () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    const center = initialPos || { lat: CITY_LAT, lng: CITY_LNG };
    const map = L.map(mapRef.current, { zoomControl: false }).setView([center.lat, center.lng], initialPos ? 15 : 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e: any) => {
      dropPin(L, map, { lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapInstanceRef.current = map;

    if (initialPos) dropPin(L, map, initialPos);
  };

  const dropPin = async (L: any, map: any, p: LatLng) => {
    if (markerRef.current) markerRef.current.remove();
    const icon = L.divIcon({
      html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="background:${pinColor};width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3)"></div>
      </div>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });
    const marker = L.marker([p.lat, p.lng], { icon, draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const lp = marker.getLatLng();
      setPos({ lat: lp.lat, lng: lp.lng });
      reverseGeocode(lp.lat, lp.lng);
    });
    markerRef.current = marker;
    setPos(p);
    reverseGeocode(p.lat, p.lng);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      if (data.display_name) {
        setAddress(data.display_name.split(',').slice(0, 4).join(',').trim());
      }
    } catch {}
  };

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 3) { setResults([]); setShowResults(false); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: `${q}, ${CITY_NAME}`,
        format: 'json',
        limit: '6',
        viewbox: CITY_VIEWBOX,
        bounded: '0',
        countrycodes: CITY_COUNTRY,
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await res.json();
      setResults(data);
      setShowResults(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 400);
  };

  const selectResult = async (r: SearchResult) => {
    const p = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    setQuery(r.display_name.split(',').slice(0, 2).join(',').trim());
    setShowResults(false);
    setResults([]);
    const L = (await import('leaflet')).default;
    const map = mapInstanceRef.current;
    if (map) {
      map.setView([p.lat, p.lng], 16);
      dropPin(L, map, p);
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
      );
      const p = { lat: position.coords.latitude, lng: position.coords.longitude };
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current;
      if (map) {
        map.setView([p.lat, p.lng], 16);
        dropPin(L, map, p);
      }
    } catch {
      alert('Could not get location. Please allow location access.');
    } finally {
      setLocating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-4 pb-3 safe-top">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
          >
            <X size={20} />
          </button>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>

        {/* Search */}
        <div className="relative z-[1001]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            autoFocus
            className="w-full bg-gray-100 rounded-xl pl-9 pr-10 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            placeholder={`Search in ${CITY_NAME}...`}
          />
          {searching ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            </div>
          ) : query ? (
            <button
              onClick={() => { setQuery(''); setResults([]); setShowResults(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        {/* Search results dropdown */}
        {showResults && results.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[1002] overflow-hidden">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => selectResult(r)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-3"
              >
                <MapPin size={14} className={`mt-0.5 flex-shrink-0 ${color === 'green' ? 'text-green-500' : 'text-red-500'}`} />
                <span className="text-gray-700 line-clamp-2">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* Use my location button */}
        <button
          onClick={useMyLocation}
          disabled={locating}
          className="absolute top-4 right-4 z-10 bg-white rounded-full p-3 shadow-lg border border-gray-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          <Crosshair size={20} />
        </button>

        {/* Center crosshair hint */}
        {!pos && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-black/60 text-white text-sm px-4 py-2 rounded-full">
              Tap on the map to place pin
            </div>
          </div>
        )}
      </div>

      {/* Bottom confirm panel */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 p-4">
        {pos ? (
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-1">Selected location</p>
            <p className="text-sm text-gray-700 line-clamp-2">{address || `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`}</p>
            <p className="text-xs text-gray-400 mt-1">{pos.lat.toFixed(6)}, {pos.lng.toFixed(6)} — drag pin to adjust</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-3 text-center">Search or tap the map to select a location</p>
        )}
        <button
          onClick={() => pos && onConfirm(pos, address)}
          disabled={!pos}
          className="w-full py-3.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: pos ? pinColor : '#e5e7eb', color: pos ? 'white' : '#9ca3af' }}
        >
          <Check size={16} />
          Confirm {title.split(' ')[0]} Location
        </button>
      </div>
    </div>
  );
}

// ─── Location selector button ────────────────────────────────────────────────
function LocationButton({
  label, color, value, address, onClick
}: {
  label: string; color: 'green' | 'red'; value: LatLng | null; address: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition text-left
        ${value
          ? color === 'green' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          : 'border-dashed border-gray-200 bg-gray-50 hover:border-gray-300'}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
        ${value
          ? color === 'green' ? 'bg-green-500' : 'bg-red-500'
          : 'bg-gray-200'}`}>
        <MapPin size={16} className={value ? 'text-white' : 'text-gray-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
        {value ? (
          <p className="text-sm text-gray-800 truncate">{address || `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`}</p>
        ) : (
          <p className="text-sm text-gray-400">Tap to select location</p>
        )}
      </div>
      <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function CreateOrderPage() {
  const router = useRouter();
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [pickup, setPickup]         = useState<LatLng | null>(null);
  const [delivery, setDelivery]     = useState<LatLng | null>(null);
  const [pickupAddr, setPickupAddr] = useState('');
  const [deliveryAddr, setDeliveryAddr] = useState('');
  const [modal, setModal]           = useState<'pickup' | 'delivery' | null>(null);
  const [form, setForm] = useState({
  pickup_address:   '',
  delivery_address: '',
  receiver_name:    '',
  receiver_phone:   '',
  item_count:       '',
  approx_weight:    '',
  item_description: '',
});

  const update = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  // Sync address fields from map selection
  useEffect(() => {
    if (pickupAddr) update('pickup_address', pickupAddr);
  }, [pickupAddr]);

  useEffect(() => {
    if (deliveryAddr) update('delivery_address', deliveryAddr);
  }, [deliveryAddr]);

  const handlePickupConfirm = (pos: LatLng, address: string) => {
    setPickup(pos);
    setPickupAddr(address);
    setModal(null);
  };

  const handleDeliveryConfirm = (pos: LatLng, address: string) => {
    setDelivery(pos);
    setDeliveryAddr(address);
    setModal(null);
  };

  const idempotencyKeyRef = useRef<string>('');

  useEffect(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup)   { setError('Please select a pickup location'); return; }
    if (!delivery) { setError('Please select a delivery location'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/orders/', {
        pickup_address:   form.pickup_address,
        pickup_lat:       pickup.lat,
        pickup_lng:       pickup.lng,
        delivery_address: form.delivery_address,
        delivery_lat:     delivery.lat,
        delivery_lng:     delivery.lng,
        receiver_name:    form.receiver_name,
        receiver_phone:   form.receiver_phone,
        item_count:       parseInt(form.item_count),
        approx_weight:    parseFloat(form.approx_weight),
        item_description: form.item_description,
        idempotency_key:  idempotencyKeyRef.current,
      });
      router.push(`/orders/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Map modals */}
      <MapModal
        open={modal === 'pickup'}
        color="green"
        title="Pickup Location"
        initialPos={pickup}
        onConfirm={handlePickupConfirm}
        onClose={() => setModal(null)}
      />
      <MapModal
        open={modal === 'delivery'}
        color="red"
        title="Delivery Location"
        initialPos={delivery}
        onConfirm={handleDeliveryConfirm}
        onClose={() => setModal(null)}
      />

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Order</h1>
            <p className="text-sm text-gray-500 mt-0.5">Set pickup and delivery locations</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Locations */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700 mb-1">Locations</p>
            <LocationButton
              label="Pickup Location"
              color="green"
              value={pickup}
              address={pickupAddr}
              onClick={() => setModal('pickup')}
            />
            <LocationButton
              label="Delivery Location"
              color="red"
              value={delivery}
              address={deliveryAddr}
              onClick={() => setModal('delivery')}
            />
          </div>

          {/* Address labels for sticker */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Address Labels</p>
              <p className="text-xs text-gray-400 mb-3">These appear on the delivery sticker attached to the item</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Address</label>
              <input
                type="text"
                value={form.pickup_address}
                onChange={e => update('pickup_address', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full pickup address for sticker"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Address</label>
              <input
                type="text"
                value={form.delivery_address}
                onChange={e => update('delivery_address', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full delivery address for sticker"
                required
              />
            </div>
          </div>

          {/* Receiver */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                <User size={13} className="text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Receiver Details</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Receiver Name</label>
                <input
                  type="text"
                  value={form.receiver_name}
                  onChange={e => update('receiver_name', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Receiver Phone</label>
                <input
                  type="text"
                  value={form.receiver_phone}
                  onChange={e => update('receiver_phone', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="9999999999"
                  required
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Receiver gets WhatsApp with tracking link and delivery OTP
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}
          {/* Item Details */}
<div className="bg-white rounded-xl border border-gray-200 p-5">
  <div className="flex items-center gap-2 mb-4">
    <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center">
      <Package size={13} className="text-orange-600" />
    </div>
    <p className="text-sm font-semibold text-gray-700">Item Details</p>
  </div>
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Number of Items</label>
        <input
          type="number"
          min="1"
          value={form.item_count}
          onChange={e => update('item_count', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="1"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Approx Weight (kg)</label>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={form.approx_weight}
          onChange={e => update('approx_weight', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0.5"
          required
        />
      </div>
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Item Description</label>
      <textarea
        value={form.item_description}
        onChange={e => update('item_description', e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        placeholder="e.g. Documents, clothes, electronics..."
        rows={2}
        required
      />
    </div>
  </div>
</div>

          <div className="flex gap-3 pb-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !pickup || !delivery}
              className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Package size={15} />
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}