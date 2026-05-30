import client from './client';

/**
 * Get the driver's current route (vehicle + remaining stops).
 * Returns: { vehicle: {...}, stops: [...] }
 */
export async function getMyRoute() {
  const response = await client.get('/driver/my-route');
  return response.data;
}

/**
 * Get items currently in the driver's vehicle.
 * Returns: [{ vehicle_id, order_id, loaded_at, ... }]
 */
export async function getMyInventory() {
  const response = await client.get('/driver/my-inventory');
  return response.data;
}

/**
 * Notify that driver has arrived at a stop.
 * Triggers WhatsApp notification to sender/receiver.
 * Returns: { message, stop_type, order_id }
 */
export async function arrivedAtStop(stopId) {
  const response = await client.post(`/driver/arrived/${stopId}`);
  return response.data;
}

/**
 * Confirm pickup via OTP entered by sender.
 * Returns: { message, delivery_otp }
 */
export async function confirmPickup(orderId, otp) {
  const response = await client.post(`/driver/confirm-pickup/${orderId}`, { otp });
  return response.data;
}

/**
 * Confirm delivery via OTP entered by receiver.
 * Returns: { message }
 */
export async function confirmDelivery(orderId, otp) {
  const response = await client.post(`/driver/confirm-delivery/${orderId}`, { otp });
  return response.data;
}

/**
 * Mark the entire route as complete.
 * Vehicle goes idle, triggers queue processing.
 * Returns: { message }
 */
export async function routeComplete() {
  const response = await client.post('/driver/route-complete');
  return response.data;
}
