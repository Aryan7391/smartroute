import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useRoute } from '../context/RouteContext';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

export default function ProfileScreen() {
  const { userName, userId, logout } = useAuth();
  const { vehicle, hasRoute } = useRoute();

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (confirmed) {
        logout();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: logout,
          },
        ]
      );
    }
  };

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account" size={40} color={colors.primary} />
        </View>
        <Text style={styles.name}>{userName || 'Driver'}</Text>
        <View style={styles.roleBadge}>
          <MaterialCommunityIcons name="steering" size={14} color={colors.primary} />
          <Text style={styles.roleText}>Driver</Text>
        </View>
      </View>

      {/* Vehicle info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle</Text>
        <View style={styles.card}>
          {vehicle ? (
            <>
              <InfoRow icon="truck" label="Vehicle Number" value={`#${vehicle.id?.substring(0, 8).toUpperCase()}`} />
              <InfoRow icon="package-variant" label="Capacity" value={`${vehicle.capacity} items`} />
              <InfoRow icon="weight" label="Max Weight" value={`${vehicle.max_weight} kg`} />
              <InfoRow
                icon="circle-slice-8"
                label="Status"
                value={vehicle.status?.charAt(0).toUpperCase() + vehicle.status?.slice(1)}
              />
            </>
          ) : (
            <View style={styles.noVehicle}>
              <MaterialCommunityIcons name="truck-alert" size={32} color={colors.textLight} />
              <Text style={styles.noVehicleText}>No vehicle assigned</Text>
            </View>
          )}
        </View>
      </View>

      {/* GPS status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GPS Tracking</Text>
        <View style={styles.card}>
          <View style={styles.gpsRow}>
            <View style={styles.gpsLeft}>
              <View style={[styles.gpsDot, hasRoute ? styles.gpsDotActive : styles.gpsDotInactive]} />
              <Text style={styles.gpsText}>
                {hasRoute ? 'Active — updating every 15s' : 'Inactive — no active route'}
              </Text>
            </View>
            <MaterialCommunityIcons
              name={hasRoute ? 'crosshairs-gps' : 'crosshairs-off'}
              size={20}
              color={hasRoute ? colors.success : colors.textLight}
            />
          </View>
        </View>
      </View>

      {/* App info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.card}>
          <InfoRow icon="information" label="Version" value="1.0.0" />
          <InfoRow icon="api" label="API" value="v1" />
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  name: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.xxl,
    color: colors.text,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  roleText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.sm,
    color: colors.primary,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.md,
    color: colors.textMuted,
  },
  infoValue: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.md,
    color: colors.text,
  },
  noVehicle: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  noVehicleText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.md,
    color: colors.textMuted,
  },
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  gpsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gpsDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gpsDotActive: {
    backgroundColor: colors.success,
  },
  gpsDotInactive: {
    backgroundColor: colors.textLight,
  },
  gpsText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.errorLight,
    backgroundColor: colors.surface,
  },
  logoutText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.md,
    color: colors.error,
  },
});
