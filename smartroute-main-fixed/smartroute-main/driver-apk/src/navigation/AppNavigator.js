import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import LoadingOverlay from '../components/LoadingOverlay';

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingOverlay message="Starting SmartRoute..." />;
  }

  return (
    <NavigationContainer>
      {token ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
