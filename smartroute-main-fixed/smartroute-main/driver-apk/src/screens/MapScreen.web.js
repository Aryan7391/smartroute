import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRoute } from '../context/RouteContext';
import * as Location from 'expo-location';
import { colors } from '../theme';
import { getStopColor, getStopLabel } from '../utils/helpers';
import { updateLocation } from '../api/vehicles';
import 'leaflet/dist/leaflet.css';

let MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, L;
try {
  const ReactLeaflet = require('react-leaflet');
  L = require('leaflet');
  MapContainer = ReactLeaflet.MapContainer;
  TileLayer = ReactLeaflet.TileLayer;
  Marker = ReactLeaflet.Marker;
  Popup = ReactLeaflet.Popup;
  Polyline = ReactLeaflet.Polyline;
  CircleMarker = ReactLeaflet.CircleMarker;
} catch (e) {
  console.warn('Failed to load react-leaflet', e);
}

const getNavigationIcon = (heading) => {
  if (!L) return null;
  const html = `
    <div style="transform: rotate(${heading}deg); transform-origin: center; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 22l10-4 10 4L12 2z" fill="#3b82f6" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export default function MapScreen() {
  const { stops, segments, vehicle, nextStop } = useRoute();
  // Default to Bhubaneswar
  const [mapCenter, setMapCenter] = useState([20.2961, 85.8245]); 
  const [deviceLoc, setDeviceLoc] = useState(null);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [dynamicRoute, setDynamicRoute] = useState(null);

  useEffect(() => {
    let subscription;
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
          (loc) => {
            setDeviceLoc([loc.coords.latitude, loc.coords.longitude]);
            if (loc.coords.heading !== null && loc.coords.heading >= 0) {
              setDeviceHeading(loc.coords.heading);
            }
          }
        );
      } catch (e) {
        console.warn('Location error:', e);
      }
    })();
    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (deviceLoc) {
      setMapCenter(deviceLoc);
      // Pushing location to backend manually since background tasks don't run on Web emulator
      if (vehicle?.id) {
        updateLocation(vehicle.id, deviceLoc[0], deviceLoc[1]).catch(e => console.warn('Web GPS sync error:', e));
      }
    } else if (vehicle && vehicle.lat && vehicle.lng) {
      setMapCenter([vehicle.lat, vehicle.lng]);
    } else if (stops.length > 0) {
      setMapCenter([stops[0].lat, stops[0].lng]);
    }
  }, [deviceLoc, vehicle, stops]);

  // Fetch live road route from OSRM to next stop
  useEffect(() => {
    const loc = deviceLoc || (vehicle?.lat ? [vehicle.lat, vehicle.lng] : null);
    if (!loc || !nextStop) {
      setDynamicRoute(null);
      return;
    }

    const fetchLiveRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${loc[1]},${loc[0]};${nextStop.lng},${nextStop.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
           const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
           setDynamicRoute(coords);
        }
      } catch(e) {
        console.warn("OSRM fetch error", e);
      }
    };

    // Debounce to avoid spamming OSRM on every GPS jitter
    const timer = setTimeout(fetchLiveRoute, 1500);
    return () => clearTimeout(timer);
  }, [deviceLoc, vehicle, nextStop]);

  if (!MapContainer) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Map library not loaded properly.</Text>
      </View>
    );
  }

  // Calculate polylines from GeoJSON segments
  const polylines = segments.map((seg, index) => {
    if (!seg.geometry?.coordinates) return null;
    // GeoJSON is [lng, lat], Leaflet is [lat, lng]
    const positions = seg.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    return (
      <Polyline
        key={index}
        positions={positions}
        color={seg.is_done ? colors.success : colors.primary}
        weight={4}
        opacity={0.8}
      />
    );
  });

  return (
    <View style={styles.container}>
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Vehicle / Device Marker */}
        {(deviceLoc || (vehicle && vehicle.lat && vehicle.lng)) && (
          <Marker
            position={deviceLoc || [vehicle.lat, vehicle.lng]}
            icon={getNavigationIcon(deviceHeading)}
          >
            <Popup>Your Location</Popup>
          </Marker>
        )}

        {/* Stops */}
        {stops.map((stop) => (
          <CircleMarker
            key={stop.id}
            center={[stop.lat, stop.lng]}
            radius={6}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: getStopColor(stop.type),
              fillOpacity: stop.is_done ? 0.4 : 1,
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'sans-serif' }}>
                <strong>{getStopLabel(stop.type)}</strong><br />
                Sequence: {stop.sequence}<br />
                Status: {stop.is_done ? 'Completed' : 'Pending'}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Route Segments */}
        {polylines}

        {/* Dynamic Road Route to Next Stop */}
        {dynamicRoute ? (
          <Polyline
            positions={dynamicRoute}
            color={colors.primary}
            weight={5}
            opacity={0.8}
            dashArray="10, 10"
          />
        ) : nextStop && (deviceLoc || (vehicle?.lat && vehicle?.lng)) ? (
          <Polyline
            positions={[
              deviceLoc || [vehicle.lat, vehicle.lng],
              [nextStop.lat, nextStop.lng]
            ]}
            color={colors.primary}
            weight={3}
            opacity={0.5}
            dashArray="8, 8"
          />
        ) : null}
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorText: {
    padding: 20,
    textAlign: 'center',
    color: colors.error,
  }
});
