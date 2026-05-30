import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RouteScreen from '../screens/RouteScreen';
import StopDetailScreen from '../screens/StopDetailScreen';
import MapScreen from '../screens/MapScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useRoute } from '../context/RouteContext';
import { colors, typography } from '../theme';

const Tab = createBottomTabNavigator();
const RouteStack = createNativeStackNavigator();

function RouteStackScreen() {
  return (
    <RouteStack.Navigator>
      <RouteStack.Screen
        name="RouteList"
        component={RouteScreen}
        options={{ headerShown: false }}
      />
      <RouteStack.Screen
        name="StopDetail"
        component={StopDetailScreen}
        options={({ route }) => ({
          title: `Stop #${route.params?.stop?.sequence || ''}`,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: typography.fontFamilySemiBold },
          headerShadowVisible: false,
        })}
      />
    </RouteStack.Navigator>
  );
}

export default function MainTabs() {
  const { inventory } = useRoute();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontFamily: typography.fontFamilyMedium,
          fontSize: 11,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: {
          fontFamily: typography.fontFamilySemiBold,
          color: colors.text,
        },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Route"
        component={RouteStackScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="road-variant" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="package-variant-closed" size={size} color={color} />
          ),
          tabBarBadge: inventory.length > 0 ? inventory.length : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            fontFamily: typography.fontFamilyBold,
            fontSize: 10,
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-circle" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
