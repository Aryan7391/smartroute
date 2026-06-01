import client from './client';

/**
 * Login with phone and password.
 * Returns: { access_token, token_type, user_id, role, name }
 */
export async function login(phone, password) {
  const response = await client.post('/auth/login', { phone, password });
  return response.data;
}

/**
 * Logout current session.
 */
export async function logout() {
  const response = await client.post('/auth/logout');
  return response.data;
}

/**
 * Get current user info.
 * Returns: { id, name, phone, email, role, is_active, last_seen }
 */
export async function getMe() {
  const response = await client.get('/auth/me');
  return response.data;
}

/**
 * Register a new user (driver).
 */
export async function register(data) {
  const response = await client.post('/auth/register', data);
  return response.data;
}
