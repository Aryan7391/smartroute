import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '../context/RouteContext';
import StatusBadge from '../components/StatusBadge';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { formatOrderId } from '../utils/helpers';

export default function InventoryScreen() {
  const { inventory, fetchInventory } = useRoute();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInventory();
    setRefreshing(false);
  }, [fetchInventory]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="package-variant-closed" size={28} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.orderId}>#{formatOrderId(item.order_id)}</Text>
          {item.status && <StatusBadge status={item.status} />}
        </View>
        {item.pickup_address && (
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="arrow-up-circle" size={14} color={colors.pickup} />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.pickup_address}
            </Text>
          </View>
        )}
        {item.delivery_address && (
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="arrow-down-circle" size={14} color={colors.delivery} />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.delivery_address}
            </Text>
          </View>
        )}
        {item.loaded_at && (
          <Text style={styles.loadedAt}>
            Loaded: {new Date(item.loaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="package-variant" size={64} color={colors.textLight} />
      <Text style={styles.emptyTitle}>Vehicle is Empty</Text>
      <Text style={styles.emptySubtitle}>
        Items will appear here after pickups are confirmed.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vehicle Inventory</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{inventory.length}</Text>
        </View>
      </View>

      <FlatList
        data={inventory}
        renderItem={renderItem}
        keyExtractor={(item) => item.order_id || item.id || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.xl,
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.primary,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  countText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sm,
    color: colors.textOnPrimary,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.md,
    color: colors.text,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addressText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  loadedAt: {
    fontFamily: typography.fontFamily,
    fontSize: typography.xs,
    color: colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: typography.xl,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
