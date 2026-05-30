import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRoute } from '../context/RouteContext';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { getStopColor, getStopLabel } from '../utils/helpers';
import { updateLocation } from '../api/vehicles';

export default function MapScreen() {
  const { stops, segments, vehicle, nextStop, deviceLoc, deviceHeading } = useRoute();
  const mapRef = useRef(null);
  const [dynamicRoute, setDynamicRoute] = useState(null);

  useEffect(() => {
    // Center map on initial load
    if (mapRef.current && stops.length > 0) {
      const coords = stops.map(s => ({ latitude: s.lat, longitude: s.lng }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [stops]);

  useEffect(() => {
    const loc = deviceLoc || (vehicle?.lat ? { latitude: vehicle.lat, longitude: vehicle.lng } : null);
    if (!loc || !nextStop) {
      setDynamicRoute(null);
      return;
    }

    const fetchLiveRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${loc.longitude},${loc.latitude};${nextStop.lng},${nextStop.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
          setDynamicRoute(coords);
        }
      } catch (e) {
        console.warn("OSRM fetch error", e);
      }
    };

    const timer = setTimeout(fetchLiveRoute, 1500);
    return () => clearTimeout(timer);
  }, [deviceLoc, vehicle, nextStop]);

  const initialRegion = {
    latitude: vehicle?.lat || stops[0]?.lat || 20.2961,
    longitude: vehicle?.lng || stops[0]?.lng || 85.8245,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Vehicle Marker */}
        {(deviceLoc || (vehicle && vehicle.lat && vehicle.lng)) && (
          <Marker
            coordinate={deviceLoc || { latitude: vehicle.lat, longitude: vehicle.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={deviceHeading}
            zIndex={100}
          >
            <View style={styles.navArrowContainer}>
              <MaterialCommunityIcons name="navigation" size={36} color="#3b82f6" />
            </View>
          </Marker>
        )}

        {/* Stops */}
        {stops.map((stop) => {
          const isNext = nextStop?.id === stop.id;
          let bgColor = stop.is_done ? colors.success : colors.error;
          if (isNext) bgColor = colors.primary; // Highlight next stop in blue

          return (
            <Marker
              key={stop.id}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              title={getStopLabel(stop.type)}
              description={`Sequence: ${stop.sequence} - ${stop.is_done ? 'Completed' : 'Pending'}`}
            >
              <View style={[styles.customMarker, { backgroundColor: bgColor }]}>
                <Text style={styles.markerText}>{stop.sequence}</Text>
              </View>
            </Marker>
          );
        })}

        {/* Route Segments */}
        {segments.map((seg, index) => {
          if (!seg.geometry?.coordinates) return null;
          const coords = seg.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
          return (
            <Polyline
              key={index}
              coordinates={coords}
              strokeColor={seg.is_done ? colors.success : colors.primary}
              strokeWidth={4}
            />
          );
        })}

        {/* Dynamic Road Route to Next Stop */}
        {dynamicRoute ? (
          <Polyline
            coordinates={dynamicRoute}
            strokeColor={colors.primary}
            strokeWidth={5}
            lineDashPattern={[10, 10]}
          />
        ) : nextStop && (deviceLoc || (vehicle?.lat && vehicle?.lng)) ? (
          <Polyline
            coordinates={[
              deviceLoc || { latitude: vehicle.lat, longitude: vehicle.lng },
              { latitude: nextStop.lat, longitude: nextStop.lng }
            ]}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 8]}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  customMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  markerText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  navArrowContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});