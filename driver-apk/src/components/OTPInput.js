import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Animated } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme';

const OTP_LENGTH = 6;

export default function OTPInput({ onComplete, error, disabled }) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Shake animation on error
  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start(() => {
        // Clear OTP after shake
        setOtp(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      });
    }
  }, [error]);

  const handleChange = (text, index) => {
    if (disabled) return;

    // Handle paste (multi-character input)
    if (text.length > 1) {
      const chars = text.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      chars.forEach((char, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();

      if (newOtp.every((d) => d !== '')) {
        onComplete?.(newOtp.join(''));
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Move to next input
    if (text && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (text && newOtp.every((d) => d !== '')) {
      onComplete?.(newOtp.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
      {otp.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputRefs.current[index] = ref)}
          style={[
            styles.input,
            digit ? styles.inputFilled : null,
            error ? styles.inputError : null,
          ]}
          value={digit}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={index === 0 ? OTP_LENGTH : 1}
          editable={!disabled}
          autoFocus={index === 0}
          selectTextOnFocus
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  input: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: typography.xl,
    fontFamily: typography.fontFamilySemiBold,
    color: colors.text,
  },
  inputFilled: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
});
