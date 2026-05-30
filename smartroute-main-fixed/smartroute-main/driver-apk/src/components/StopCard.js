import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { getStopAddress, getStopColor, getStopBgColor, getStopLabel } from '../utils/helpers';

export default function StopCard({ stop, index, onPress, isNext }) {
  const stopColor = getStopColor(stop.type);
  const isLive = stop.orders?.is_live_injection;

  const openInMaps = (e) => {
    e.stopPropagation(); // prevent card tap
    const lat = stop.lat;
    const lng = stop.lng;
    const address = getStopAddress(stop);
    const label = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      web: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url);
  };
  const stopBg = getStopBgColor(stop.type);
  const label = getStopLabel(stop.type);
  const address = getStopAddress(stop);
  const isDone = stop.is_done;

  const iconName =
    stop.type === 'pickup'
      ? 'package-up'
      : stop.type === 'delivery'
      ? 'package-down'
      : 'keyboard-return';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isNext && styles.cardNext,
        isDone && styles.cardDone,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isDone}
    >
      {/* Sequence number */}
      <View style={[styles.sequenceBadge, { backgroundColor: isDone ? colors.border : stopColor }]}>
        {isDone ? (
          <MaterialCommunityIcons name="check" size={16} color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.sequenceText}>{stop.sequence}</Text>
        )}
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.typeBadge, { backgroundColor: isDone ? colors.borderLight : stopBg }]}>
            <MaterialCommunityIcons
              name={iconName}
              size={14}
              color={isDone ? colors.textMuted : stopColor}
            />
            <Text style={[styles.typeText, { color: isDone ? colors.textMuted : stopColor }]}>
              {label}
            </Text>
          </View>
          {isLive && !isDone && (
            <View style={[styles.nextBadge, { backgroundColor: colors.warning }]}>
              <Text style={styles.nextText}>LIVE ADDITION</Text>
            </View>
          )}
          {isNext && !isDone && (
            <View style={styles.nextBadge}>
              <Text style={styles.nextText}>NEXT</Text>
            </View>
          )}
        </View>
        <Text style={[styles.address, isDone && styles.addressDone]} numberOfLines={2}>
          {address}
        </Text>
        {stop.orders?.item_description && !isDone && (
          <Text style={styles.itemDesc} numberOfLines={1}>
            {stop.orders.item_description}
          </Text>
        )}
      </View>

      {isNext && !isDone ? (
        <TouchableOpacity style={styles.quickNavBtn} onPress={openInMaps}>
          <MaterialCommunityIcons name="navigation-variant" size={20} color={colors.textOnPrimary} />
          <Text style={styles.quickNavText}>Navigate</Text>
        </TouchableOpacity>
      ) : !isDone ? (
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={colors.textLight}
          style={styles.chevron}
        />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardNext: {
    borderColor: colors.primary,
    borderWidth: 2,
    ...shadows.md,
  },
  cardDone: {
    opacity: 0.6,
    backgroundColor: colors.borderLight,
    borderColor: colors.borderLight,
  },
  sequenceBadge: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  sequenceText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.sm,
    color: colors.textOnPrimary,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  typeText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  nextText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 10,
    color: colors.textOnPrimary,
    letterSpacing: 1,
  },
  address: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.md,
    color: colors.text,
    lineHeight: 22,
  },
  addressDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  itemDesc: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
  quickNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: 4,
    marginLeft: spacing.sm,
  },
  quickNavText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.xs,
    color: colors.textOnPrimary,
  },
});
