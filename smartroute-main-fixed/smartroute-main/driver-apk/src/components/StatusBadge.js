import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme';

const STATUS_CONFIG = {
  pending: { label: 'Pending', bg: '#DBEAFE', color: '#1D4ED8' },
  picked_up: { label: 'Picked Up', bg: '#D1FAE5', color: '#059669' },
  delivered: { label: 'Delivered', bg: '#DCFCE7', color: '#16A34A' },
  failed_pickup: { label: 'Failed Pickup', bg: '#FEE2E2', color: '#DC2626' },
  failed_delivery: { label: 'Failed Delivery', bg: '#FEE2E2', color: '#DC2626' },
  escalated: { label: 'Escalated', bg: '#FEF3C7', color: '#D97706' },
  return_to_sender: { label: 'Return', bg: '#FEF3C7', color: '#D97706' },
  returned: { label: 'Returned', bg: '#E2E8F0', color: '#64748B' },
  queued: { label: 'Queued', bg: '#E2E8F0', color: '#64748B' },
};

export default function StatusBadge({ status, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || { label: status, bg: '#E2E8F0', color: '#64748B' };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'lg' && styles.badgeLg]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }, size === 'lg' && styles.textLg]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  badgeLg: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textLg: {
    fontSize: typography.sm,
  },
});
