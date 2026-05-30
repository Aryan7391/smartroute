import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, logout as apiLogout, getMe } from '../api/auth';

const AuthContext = createContext(null);

const initialState = {
  token: null,
  userId: null,
  userName: null,
  role: null,
  isLoading: true,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'RESTORE_TOKEN':
      return {
        ...state,
        token: action.token,
        userId: action.userId,
        userName: action.userName,
        role: action.role,
        isLoading: false,
      };
    case 'LOGIN':
      return {
        ...state,
        token: action.token,
        userId: action.userId,
        userName: action.userName,
        role: action.role,
        error: null,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // On app start, try to restore token from SecureStore
  useEffect(() => {
    async function restoreToken() {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const userDataStr = await AsyncStorage.getItem('user_data');

        if (token && userDataStr) {
          const userData = JSON.parse(userDataStr);
          // Validate token is still active
          try {
            await getMe();
            dispatch({
              type: 'RESTORE_TOKEN',
              token,
              userId: userData.userId,
              userName: userData.userName,
              role: userData.role,
            });
            return;
          } catch {
            // Token expired or invalid — clear and go to login
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('user_data');
          }
        }
        dispatch({ type: 'RESTORE_TOKEN', token: null, userId: null, userName: null, role: null });
      } catch {
        dispatch({ type: 'RESTORE_TOKEN', token: null, userId: null, userName: null, role: null });
      }
    }
    restoreToken();
  }, []);

  const login = async (phone, password) => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      const data = await apiLogin(phone, password);

      if (data.role !== 'driver') {
        throw new Error('This app is only for drivers');
      }

      await AsyncStorage.setItem('auth_token', data.access_token);
      await AsyncStorage.setItem(
        'user_data',
        JSON.stringify({
          userId: data.user_id,
          userName: data.name,
          role: data.role,
        })
      );

      dispatch({
        type: 'LOGIN',
        token: data.access_token,
        userId: data.user_id,
        userName: data.name,
        role: data.role,
      });
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.message ||
        'Login failed. Please try again.';
      dispatch({ type: 'SET_ERROR', error: message });
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore logout API errors — clear locally regardless
    }
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user_data');
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
