import client from './client';

/**
 * Mark pickup as failed — sender not present.
 */
export async function failPickup(orderId) {
  const response = await client.patch(`/orders/${orderId}/fail-pickup`);
  return response.data;
}

/**
 * Mark delivery as failed — receiver not present.
 * Auto-escalates after 2nd failure.
 */
export async function failDelivery(orderId) {
  const response = await client.patch(`/orders/${orderId}/fail-delivery`);
  return response.data;
}
