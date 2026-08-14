import { forwardRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/state/settings';
import { alpha, radius, space, type } from './theme';

type Variant = keyof typeof type;

export function Text({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const colors = useColors();
  return <RNText {...rest} style={[type[variant], { color: color ?? colors.text }, style]} />;
}

/** Small uppercase label used for section headers and metadata. */
export function Label({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  return (
    <Text variant="label" color={color ?? colors.textFaint} style={[{ textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline }, style]} />;
}

type TouchProps = PressableProps & {
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Pressable with a consistent press state and an optional light tap. */
export const Touchable = forwardRef<View, TouchProps>(function Touchable(
  { haptic = true, onPress, style, children, ...rest },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      {...rest}
      onPress={(event) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
});

export function Chip({
  label,
  active,
  accent,
  onPress,
  disabled,
}: {
  label: string;
  active?: boolean;
  accent: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: space.lg,
        paddingVertical: 9,
        borderRadius: radius.pill,
        backgroundColor: active ? alpha(accent, 0.18) : colors.surfaceHigh,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? alpha(accent, 0.6) : colors.hairline,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Text variant="caption" color={active ? accent : colors.textMuted}>
        {label}
      </Text>
    </Touchable>
  );
}

export function PrimaryButton({
  label,
  accent,
  onPress,
  disabled,
  style,
}: {
  label: string;
  accent: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          paddingVertical: 15,
          paddingHorizontal: space.xl,
          borderRadius: radius.md,
          backgroundColor: disabled ? colors.surfaceHigh : accent,
          alignItems: 'center',
        },
        style,
      ]}
    >
      {/* The label sits on the accent, so it takes the background's colour, not
          the theme's text colour — an accent is bright in both themes. */}
      <Text variant="heading" color={disabled ? colors.textFaint : '#0B0E13'}>
        {label}
      </Text>
    </Touchable>
  );
}

export function GhostButton({
  label,
  onPress,
  accent,
  style,
}: {
  label: string;
  onPress: () => void;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Touchable
      onPress={onPress}
      style={[
        {
          paddingVertical: 14,
          paddingHorizontal: space.xl,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.hairlineStrong,
          alignItems: 'center',
        },
        style,
      ]}
    >
      <Text variant="heading" color={accent ?? colors.textMuted}>
        {label}
      </Text>
    </Touchable>
  );
}
