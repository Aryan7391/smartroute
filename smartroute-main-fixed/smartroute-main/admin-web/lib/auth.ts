import api from './api';

export const login = async (phone: string, password: string) => {
  const res = await api.post('/auth/login', { phone, password });
  const { access_token, role, name, user_id } = res.data;

  if (role !== 'admin' && role !== 'manager') {
    throw new Error('Access denied. Admin or Manager accounts only.');
  }

  localStorage.setItem('token', access_token);
  localStorage.setItem('role', role);
  localStorage.setItem('name', name);
  localStorage.setItem('user_id', user_id);
  return res.data;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    localStorage.removeItem('user_id');
    window.location.href = '/login';
  }
};

export const getToken = () => localStorage.getItem('token');
export const getRole = () => localStorage.getItem('role');
export const getName = () => localStorage.getItem('name');
export const isAuthenticated = () => !!localStorage.getItem('token');