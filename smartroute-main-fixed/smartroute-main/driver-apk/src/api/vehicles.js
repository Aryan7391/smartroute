import client from './client';

/**
 * Update vehicle GPS location.
 * Called every 15 seconds from background task.
 */
export async function updateLocation(vehicleId, lat, lng) {
  const response = await client.patch(`/vehicles/${vehicleId}/location`, { lat, lng });
  return response.data;
}

/**
 * Get route segments (GeoJSON polylines) for map display.
 * Returns: [{ from_sequence, to_sequence, geometry, is_done }]
 */
export async function getSegments(vehicleId) {
  const response = await client.get(`/vehicles/${vehicleId}/segments`);
  return response.data;
}
