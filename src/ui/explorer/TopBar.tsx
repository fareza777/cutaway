import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Text, Touchable } from '../primitives';
import { useColors, useReadableAccent, useT } from '@/state/settings';
import { alpha, radius, space } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function IconButton({
  icon,
  onPress,
  active,
  accent,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  active?: boolean;
  accent: string;
  label: string;
}) {
  const colors = useColors();
  const accentText = useReadableAccent(accent);
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[
        styles.iconButton,
        {
          backgroundColor: active ? alpha(accent, 0.2) : colors.floating,
          borderColor: active ? alpha(accent, 0.55) : colors.hairline,
        },
      ]}
    >
      <Ionicons name={icon} size={19} color={active ? accentText : colors.textMuted} />
    </Touchable>
  );
}

export function TopBar({
  title,
  subtitle,
  accent,
  top,
  autoRotate,
  onBack,
  onReset,
  onToggleAutoRotate,
  onToggleTheme,
  themeMode,
}: {
  title: string;
  subtitle: string;
  accent: string;
  top: number;
  autoRotate: boolean;
  onBack: () => void;
  onReset: () => void;
  onToggleAutoRotate: () => void;
  onToggleTheme: () => void;
  themeMode: 'dark' | 'light';
}) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={[styles.bar, { paddingTop: top + space.sm }]} pointerEvents="box-none">
      <IconButton icon="chevron-back" onPress={onBack} accent={accent} label={t('explorer.back')} />

      <View style={styles.titles} pointerEvents="none">
        <Text variant="heading" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color={colors.textFaint} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.actions}>
        <IconButton
          icon={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
          onPress={onToggleTheme}
          accent={accent}
          label={themeMode === 'dark' ? t('settings.light') : t('settings.dark')}
        />
        <IconButton
          icon="sync-outline"
          onPress={onToggleAutoRotate}
          active={autoRotate}
          accent={accent}
          label={t('explorer.autoRotate')}
        />
        <IconButton icon="refresh-outline" onPress={onReset} accent={accent} label={t('explorer.reset')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  titles: { flex: 1, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: space.sm },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
