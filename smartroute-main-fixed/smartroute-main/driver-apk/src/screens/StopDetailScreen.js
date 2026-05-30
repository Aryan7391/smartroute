import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import OTPInput from '../components/OTPInput';
import StatusBadge from '../components/StatusBadge';
import LoadingOverlay from '../components/LoadingOverlay';
import { arrivedAtStop, confirmPickup, confirmDelivery } from '../api/driver';
import { failPickup, failDelivery } from '../api/orders';
import { useRoute } from '../context/RouteContext';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import {
  getStopAddress,
  getStopColor,
  getStopLabel,
  formatWeight,
  formatOrderId,
} from '../utils/helpers';
import { STOP_TYPES } from '../utils/constants';

export default function StopDetailScreen({ route: navRoute, navigation }) {
  const { stop } = navRoute.params;
  const { refreshAll } = useRoute();

  const [hasArrived, setHasArrived] = useState(!!stop.arrived_at);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [otpError, setOtpError] = useState(null);
  const [otpErrorCount, setOtpErrorCount] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  const stopColor = getStopColor(stop.type);
  const label = getStopLabel(stop.type);
  const address = getStopAddress(stop);
  const order = stop.orders || {};
  const orderId = stop.order_id;

  const isPickup = stop.type === STOP_TYPES.PICKUP;
  const isDelivery = stop.type === STOP_TYPES.DELIVERY;

  const handleArrived = async () => {
    setLoading(true);
    setLoadingAction('Recording arrival...');
    try {
      await arrivedAtStop(stop.id);
      setHasArrived(true);
      Alert.alert(
        'Arrived!',
        `${isPickup ? 'Sender' : 'Receiver'} has been notified.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to record arrival');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleOTPSubmit = async (otp) => {
    setLoading(true);
    setOtpError(null);
    setLoadingAction(isPickup ? 'Confirming pickup...' : 'Confirming delivery...');
    try {
      if (isPickup) {
        await confirmPickup(orderId, otp);
      } else {
        await confirmDelivery(orderId, otp);
      }
      setConfirmed(true);
      await refreshAll();
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (error) {
      const message = error.response?.data?.detail || 'Incorrect OTP';
      setOtpError(message);
      setOtpErrorCount((c) => c + 1);
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleFailPickup = () => {
    Alert.alert(
      'Sender Not Present',
      'Mark this pickup as failed? The sender will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Failed',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setLoadingAction('Marking as failed...');
            try {
              await failPickup(orderId);
              await refreshAll();
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to update');
            } finally {
              setLoading(false);
              setLoadingAction('');
            }
          },
        },
      ]
    );
  };

  const handleFailDelivery = () => {
    Alert.alert(
      'Receiver Not Present',
      'Mark this delivery as failed? This will count as an attempt.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Failed',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setLoadingAction('Marking as failed...');
            try {
              await failDelivery(orderId);
              await refreshAll();
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to update');
            } finally {
              setLoading(false);
              setLoadingAction('');
            }
          },
        },
      ]
    );
  };

  const openInMaps = () => {
    const lat = stop.lat;
    const lng = stop.lng;
    const label = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      web: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url);
  };

  if (confirmed) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <MaterialCommunityIcons name="check-circle" size={80} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>
          {isPickup ? 'Pickup Confirmed!' : 'Delivery Confirmed!'}
        </Text>
        <Text style={styles.successSubtitle}>Returning to route...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stop type header */}
        <View style={[styles.typeHeader, { backgroundColor: stopColor }]}>
          <MaterialCommunityIcons
            name={isPickup ? 'package-up' : 'package-down'}
            size={24}
            color={colors.textOnPrimary}
          />
          <Text style={styles.typeHeaderText}>{label} Stop</Text>
          <Text style={styles.typeHeaderSeq}>#{stop.sequence}</Text>
        </View>

        {/* Address card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="map-marker" size={20} color={stopColor} />
            <Text style={styles.cardTitle}>
              {isPickup ? 'Pickup Address' : 'Delivery Address'}
            </Text>
          </View>
          <Text style={styles.addressText}>{address}</Text>
          <TouchableOpacity style={styles.directionsBtn} onPress={openInMaps}>
            <MaterialCommunityIcons name="navigation-variant" size={18} color={colors.primary} />
            <Text style={styles.directionsBtnText}>Open in Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Order details card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="package-variant" size={20} color={colors.textMuted} />
            <Text style={styles.cardTitle}>Order Details</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order ID</Text>
            <Text style={styles.detailValue}>{formatOrderId(orderId)}</Text>
          </View>

          {order.item_description && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Items</Text>
              <Text style={styles.detailValue}>{order.item_description}</Text>
            </View>
          )}

          {order.item_count && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Count</Text>
              <Text style={styles.detailValue}>{order.item_count} items</Text>
            </View>
          )}

          {order.approx_weight && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Weight</Text>
              <Text style={styles.detailValue}>{formatWeight(order.approx_weight)}</Text>
            </View>
          )}

          {isDelivery && order.receiver_name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Receiver</Text>
              <Text style={styles.detailValue}>{order.receiver_name}</Text>
            </View>
          )}

          {isDelivery && order.receiver_phone && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.receiver_phone}`)}>
                <Text style={[styles.detailValue, { color: colors.primary }]}>
                  {order.receiver_phone}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action area */}
        {!hasArrived ? (
          <View style={styles.actionCard}>
            <TouchableOpacity
              style={[styles.arrivedButton, { backgroundColor: stopColor }]}
              onPress={handleArrived}
              activeOpacity={0.8}
              disabled={loading}
            >
              <MaterialCommunityIcons name="map-marker-check" size={24} color={colors.textOnPrimary} />
              <Text style={styles.arrivedButtonText}>I've Arrived</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionCard}>
            <View style={styles.otpHeader}>
              <MaterialCommunityIcons name="shield-key" size={24} color={colors.primary} />
              <Text style={styles.otpTitle}>
                {isPickup ? "Enter Sender's OTP" : "Enter Receiver's OTP"}
              </Text>
            </View>
            <Text style={styles.otpSubtitle}>
              {isPickup
                ? 'Ask the sender for the 6-digit OTP they received'
                : 'Ask the receiver for the 6-digit delivery OTP'}
            </Text>
            <OTPInput
              onComplete={handleOTPSubmit}
              error={otpError}
              disabled={loading}
              key={otpErrorCount}
            />
            {otpError && (
              <Text style={styles.otpErrorText}>{otpError}</Text>
            )}
          </View>
        )}

        {/* Report issue — tucked away to prevent accidental taps */}
        {!confirmed && (
          <View style={styles.reportSection}>
            <Text style={styles.reportTitle}>Having issues?</Text>
            <TouchableOpacity
              style={styles.reportButton}
              onPress={isPickup ? handleFailPickup : handleFailDelivery}
            >
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.reportButtonText}>
                {isPickup ? 'Sender Not Present' : 'Receiver Not Present'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {loading && <LoadingOverlay message={loadingAction} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  typeHeaderText: {
    flex: 1,
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.lg,
    color: colors.textOnPrimary,
  },
  typeHeaderSeq: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.md,
    color: 'rgba(255,255,255,0.8)',
  },
  card: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  addressText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.lg,
    color: colors.text,
    lineHeight: 26,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  directionsBtnText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.sm,
    color: colors.primary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  detailValue: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.sm,
    color: colors.text,
    textAlign: 'right',
    flex: 1,
    marginLeft: spacing.md,
  },
  actionCard: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.md,
  },
  arrivedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  arrivedButtonText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.lg,
    color: colors.textOnPrimary,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  otpTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.lg,
    color: colors.text,
  },
  otpSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  otpErrorText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sm,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  reportSection: {
    margin: spacing.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  reportTitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.textLight,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.errorLight,
  },
  reportButtonText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sm,
    color: colors.error,
  },
  successContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successIcon: {
    marginBottom: spacing.md,
  },
  successTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.xxl,
    color: colors.success,
  },
  successSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
