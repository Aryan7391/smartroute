import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Alert,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '../context/RouteContext';
import StopCard from '../components/StopCard';
import RouteCompleteBar from '../components/RouteCompleteBar';
import LoadingOverlay from '../components/LoadingOverlay';
import { routeComplete } from '../api/driver';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { ROUTE_REFRESH_DELAY } from '../utils/constants';
import { useFocusEffect } from '@react-navigation/native';

export default function RouteScreen({ navigation }) {
  const {
    stops,
    remainingStops,
    completedStops,
    vehicle,
    isLoading,
    hasRoute,
    allDone,
    nextStop,
    progress,
    refreshAll,
    fetchRoute,
  } = useRoute();

  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [routeUpdated, setRouteUpdated] = useState(false);
  const prevNextStopId = useRef(nextStop?.id);

  useEffect(() => {
    refreshAll();
    // Auto-polling every 30 seconds
    const interval = setInterval(() => {
      refreshAll();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  useEffect(() => {
    // Detect route updates (if nextStop changed, and it wasn't just cleared)
    if (nextStop?.id && prevNextStopId.current && nextStop.id !== prevNextStopId.current) {
      setRouteUpdated(true);
      // Auto-hide alert after 8 seconds
      setTimeout(() => setRouteUpdated(false), 8000);
    }
    prevNextStopId.current = nextStop?.id;
  }, [nextStop?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  const handleStopPress = (stop) => {
    navigation.navigate('StopDetail', { stop });
  };

  const handleRouteComplete = () => {
    const doComplete = async () => {
      setCompleting(true);
      try {
        await routeComplete();
        setTimeout(async () => {
          await refreshAll();
          setCompleting(false);
        }, ROUTE_REFRESH_DELAY);
      } catch (error) {
        Alert.alert(
          'Error',
          error.response?.data?.detail || 'Failed to complete route'
        );
        setCompleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure all stops are done and you want to complete this route?')) {
        doComplete();
      }
    } else {
      Alert.alert(
        'Complete Route',
        'Are you sure all stops are done and you want to complete this route?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete', style: 'default', onPress: doComplete },
        ]
      );
    }
  };

  const renderItem = ({ item, index }) => (
    <StopCard
      stop={item}
      index={index}
      isNext={nextStop?.id === item.id}
      onPress={() => handleStopPress(item)}
    />
  );

  const renderHeader = () => (
    <View style={styles.headerCard}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.headerTitle}>Today's Route</Text>
          <Text style={styles.headerSubtitle}>
            {progress.total > 0
              ? `${progress.done} of ${progress.total} stops completed`
              : 'No stops assigned'}
          </Text>
        </View>
        {progress.total > 0 && (
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>
              {progress.done}/{progress.total}
            </Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      {progress.total > 0 && (
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${(progress.done / progress.total) * 100}%` },
            ]}
          />
        </View>
      )}

      {vehicle && (
        <View style={styles.vehicleInfo}>
          <MaterialCommunityIcons name="truck" size={16} color={colors.textMuted} />
          <Text style={styles.vehicleText}>
            Capacity: {vehicle.capacity} • Max: {vehicle.max_weight} kg
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="map-marker-check" size={64} color={colors.textLight} />
      <Text style={styles.emptyTitle}>No Route Assigned</Text>
      <Text style={styles.emptySubtitle}>
        Waiting for dispatch. Pull down to refresh.
      </Text>
    </View>
  );

  if (isLoading && !refreshing && stops.length === 0) {
    return <LoadingOverlay message="Loading route..." />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {routeUpdated && (
        <View style={styles.alertBanner}>
          <MaterialCommunityIcons name="alert-decagram" size={20} color={colors.textOnPrimary} />
          <Text style={styles.alertBannerText}>Route Updated: Your next stop has changed!</Text>
          <TouchableOpacity onPress={() => setRouteUpdated(false)}>
            <MaterialCommunityIcons name="close" size={20} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={[...remainingStops, ...completedStops]}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          allDone && { paddingBottom: 120 },
        ]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
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

      {allDone && hasRoute && (
        <RouteCompleteBar onPress={handleRouteComplete} loading={completing} />
      )}

      {completing && <LoadingOverlay message="Completing route..." />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  alertBannerText: {
    flex: 1,
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sm,
    color: colors.textOnPrimary,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.xl,
    color: colors.text,
  },
  headerSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  progressBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.md,
    color: colors.textOnPrimary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: 3,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  vehicleText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
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
  },
});
