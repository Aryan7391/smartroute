export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://smartroute-production.up.railway.app/api/v1';
// 10.0.2.2 is Android emulator's alias for host machine localhost
// For iOS simulator, use 'http://localhost:8000/api/v1'
// For physical device, use your LAN IP e.g. 'http://192.168.x.x:8000/api/v1'

export const GPS_UPDATE_INTERVAL = 15000; // 15 seconds
export const GPS_DISTANCE_INTERVAL = 10; // minimum 10 meters movement
export const ROUTE_REFRESH_DELAY = 2000; // 2s delay after route-complete before checking for new route

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

export const STOP_TYPES = {
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
  RETURN: 'return',
};

export const ORDER_STATUSES = {
  PENDING: 'pending',
  PICKED_UP: 'picked_up',
  DELIVERED: 'delivered',
  FAILED_PICKUP: 'failed_pickup',
  FAILED_DELIVERY: 'failed_delivery',
  ESCALATED: 'escalated',
  RETURN_TO_SENDER: 'return_to_sender',
  RETURNED: 'returned',
  QUEUED: 'queued',
};
