import { STOP_TYPES } from './constants';
import { colors } from '../theme';

/**
 * Get the display address for a stop based on its type.
 */
export function getStopAddress(stop) {
  if (!stop?.orders) return 'Unknown address';
  if (stop.type === STOP_TYPES.PICKUP) {
    return stop.orders.pickup_address || 'Pickup address';
  }
  return stop.orders.delivery_address || 'Delivery address';
}

/**
 * Get color for a stop type.
 */
export function getStopColor(type) {
  switch (type) {
    case STOP_TYPES.PICKUP:
      return colors.pickup;
    case STOP_TYPES.DELIVERY:
      return colors.delivery;
    case STOP_TYPES.RETURN:
      return colors.warning;
    default:
      return colors.textMuted;
  }
}

/**
 * Get light background color for a stop type.
 */
export function getStopBgColor(type) {
  switch (type) {
    case STOP_TYPES.PICKUP:
      return colors.pickupLight;
    case STOP_TYPES.DELIVERY:
      return colors.deliveryLight;
    case STOP_TYPES.RETURN:
      return colors.warningLight;
    default:
      return colors.borderLight;
  }
}

/**
 * Get label for a stop type.
 */
export function getStopLabel(type) {
  switch (type) {
    case STOP_TYPES.PICKUP:
      return 'Pickup';
    case STOP_TYPES.DELIVERY:
      return 'Delivery';
    case STOP_TYPES.RETURN:
      return 'Return';
    default:
      return type;
  }
}

/**
 * Format an order ID for display (first 8 chars).
 */
export function formatOrderId(id) {
  if (!id) return '';
  return id.substring(0, 8).toUpperCase();
}

/**
 * Decode GeoJSON LineString coordinates into lat/lng array for react-native-maps Polyline.
 * GeoJSON uses [lng, lat], MapView uses { latitude, longitude }.
 */
export function decodeGeoJSONLineString(geometry) {
  if (!geometry?.coordinates) return [];
  return geometry.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));
}

/**
 * Format a timestamp to a short time string.
 */
export function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format weight with unit.
 */
export function formatWeight(kg) {
  if (!kg && kg !== 0) return '';
  return `${kg} kg`;
}
