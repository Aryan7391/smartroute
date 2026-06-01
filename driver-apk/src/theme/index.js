import { moderateScale } from '../utils/responsive';

export const colors = {
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',

  pickup: '#059669',
  pickupLight: '#D1FAE5',
  delivery: '#DC2626',
  deliveryLight: '#FEE2E2',

  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  error: '#DC2626',
  errorLight: '#FEE2E2',

  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textLight: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  textOnPickup: '#FFFFFF',
  textOnDelivery: '#FFFFFF',

  overlay: 'rgba(15, 23, 42, 0.5)',
  shadow: 'rgba(15, 23, 42, 0.08)',
};

export const typography = {
  fontFamily: 'Inter',
  fontFamilyMedium: 'Inter-Medium',
  fontFamilySemiBold: 'Inter-SemiBold',
  fontFamilyBold: 'Inter-Bold',

  xs: moderateScale(11),
  sm: moderateScale(13),
  md: moderateScale(15),
  lg: moderateScale(18),
  xl: moderateScale(22),
  xxl: moderateScale(28),
  xxxl: moderateScale(34),
};

export const spacing = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(16),
  lg: moderateScale(24),
  xl: moderateScale(32),
  xxl: moderateScale(48),
};

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
};

const theme = { colors, typography, spacing, borderRadius, shadows };
export default theme;
