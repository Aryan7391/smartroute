import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKGROUND_LOCATION_TASK, GPS_UPDATE_INTERVAL, GPS_DISTANCE_INTERVAL } from '../utils/constants';
import { updateLocation } from '../api/vehicles';

// Define the background task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (!location) return;

    try {
      const vehicleId = await AsyncStorage.getItem('vehicle_id');
      if (vehicleId) {
        await updateLocation(vehicleId, location.coords.latitude, location.coords.longitude);
      }
    } catch (e) {
      console.error('Failed to update location:', e.message);
    }
  }
});

/**
 * Start background location tracking.
 * Call this when driver has an active route.
 */
export async function startLocationTracking(vehicleId) {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    console.warn('Foreground location permission not granted');
    return false;
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    console.warn('Background location permission not granted');
    return false;
  }

  // Store vehicleId for the background task to use
  await AsyncStorage.setItem('vehicle_id', vehicleId);

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    return true; // Already running
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: GPS_UPDATE_INTERVAL,
    distanceInterval: GPS_DISTANCE_INTERVAL,
    deferredUpdatesInterval: GPS_UPDATE_INTERVAL,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'SmartRoute',
      notificationBody: 'Tracking your location for deliveries',
      notificationColor: '#2563EB',
    },
  });

  return true;
}

/**
 * Stop background location tracking.
 * Call this when route is complete or driver logs out.
 */
export async function stopLocationTracking() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
  await AsyncStorage.removeItem('vehicle_id');
}
