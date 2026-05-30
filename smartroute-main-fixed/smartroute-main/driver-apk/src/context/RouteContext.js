import React, { createContext, useContext, useReducer, useCallback, useState, useEffect } from 'react';
import { getMyRoute, getMyInventory } from '../api/driver';
import { getSegments, updateLocation as apiUpdateLocation } from '../api/vehicles';
import * as Location from 'expo-location';

const RouteContext = createContext(null);

const initialState = {
  vehicle: null,
  stops: [],
  segments: [],
  inventory: [],
  isLoading: false,
  error: null,
};

function routeReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: true, error: null };
    case 'SET_ROUTE':
      return {
        ...state,
        vehicle: action.vehicle,
        stops: action.stops || [],
        isLoading: false,
        error: null,
      };
    case 'SET_SEGMENTS':
      return { ...state, segments: action.segments || [] };
    case 'SET_INVENTORY':
      return { ...state, inventory: action.inventory || [] };
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.error };
    case 'CLEAR':
      return { ...initialState };
    default:
      return state;
  }
}

export function RouteProvider({ children }) {
  const [state, dispatch] = useReducer(routeReducer, initialState);
  const [deviceLoc, setDeviceLoc] = useState(null);
  const [deviceHeading, setDeviceHeading] = useState(0);

  // Global GPS Tracking
  useEffect(() => {
    let locSubscription;
    let headingSubscription;

    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        
        locSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 0 },
          (loc) => {
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setDeviceLoc(coords);
            if (loc.coords.heading !== null && loc.coords.heading >= 0 && !headingSubscription) {
              setDeviceHeading(loc.coords.heading);
            }
            if (state.vehicle?.id) {
              apiUpdateLocation(state.vehicle.id, coords.latitude, coords.longitude)
                .then(() => console.log('✅ Global GPS synced:', coords.latitude, coords.longitude))
                .catch((err) => console.log('❌ Global GPS sync failed:', err.message));
            }
          }
        );

        headingSubscription = await Location.watchHeadingAsync((headingObj) => {
          if (headingObj.trueHeading >= 0) {
            setDeviceHeading(headingObj.trueHeading);
          } else if (headingObj.magHeading >= 0) {
            setDeviceHeading(headingObj.magHeading);
          }
        });

      } catch (e) {
        console.warn('Global Location error:', e);
      }
    })();

    return () => {
      if (locSubscription) locSubscription.remove();
      if (headingSubscription) headingSubscription.remove();
    };
  }, [state.vehicle]);

  const fetchRoute = useCallback(async () => {
    dispatch({ type: 'SET_LOADING' });
    try {
      const data = await getMyRoute();
      dispatch({
        type: 'SET_ROUTE',
        vehicle: data.vehicle,
        stops: (data.stops || []).sort((a, b) => a.sequence - b.sequence),
      });
      return data;
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to load route';
      dispatch({ type: 'SET_ERROR', error: message });
      return null;
    }
  }, []);

  const fetchSegments = useCallback(async (vehicleId) => {
    if (!vehicleId) return;
    try {
      const data = await getSegments(vehicleId);
      dispatch({ type: 'SET_SEGMENTS', segments: data });
    } catch {
      // Segments are non-critical, fail silently
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const data = await getMyInventory();
      dispatch({ type: 'SET_INVENTORY', inventory: data });
    } catch {
      // Inventory fetch failure is non-critical
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const routeData = await fetchRoute();
    if (routeData?.vehicle?.id) {
      await Promise.all([
        fetchSegments(routeData.vehicle.id),
        fetchInventory(),
      ]);
    }
  }, [fetchRoute, fetchSegments, fetchInventory]);

  const clearRoute = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  // Computed values
  const remainingStops = state.stops.filter((s) => !s.is_done);
  const completedStops = state.stops.filter((s) => s.is_done);
  const nextStop = remainingStops[0] || null;
  const hasRoute = state.vehicle?.status === 'active';
  const allDone = hasRoute && remainingStops.length === 0;
  const progress = state.stops.length > 0
    ? { done: completedStops.length, total: state.stops.length }
    : { done: 0, total: 0 };

  return (
    <RouteContext.Provider
      value={{
        ...state,
        deviceLoc,
        deviceHeading,
        remainingStops,
        completedStops,
        nextStop,
        allDone,
        hasRoute,
        progress,
        fetchRoute,
        fetchSegments,
        fetchInventory,
        refreshAll,
        clearRoute,
      }}
    >
      {children}
    </RouteContext.Provider>
  );
}

export function useRoute() {
  const context = useContext(RouteContext);
  if (!context) {
    throw new Error('useRoute must be used within a RouteProvider');
  }
  return context;
}
