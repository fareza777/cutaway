/**
 * The tool rail.
 *
 * Three of the tools are continuous (explode, peel, cut) and share one slider
 * rather than each owning a permanent one — chrome over a 3D view should be the
 * exception, not the default. Selecting a tool reveals its slider; selecting it
 * again puts it away and returns the value to zero.
 */

import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Slider } from '../Slider';
import { Text, Touchable } from '../primitives';
import { useColors, useT } from '@/state/settings';
import { alpha, radius, space } from '../theme';

export type ToolId = 'explode' | 'peel' | 'cut';

export type ToolValues = Record<ToolId, number>;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TOOLS: { id: ToolId; icon: IconName }[] = [
  { id: 'explode', icon: 'scan-outline' },
  { id: 'peel', icon: 'layers-outline' },
  { id: 'cut', icon: 'cut-outline' },
];

function ToolButton({
  label,
  icon,
  active,
  accent,
  onPress,
  disabled,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  accent: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      style={[
        styles.tool,
        {
          backgroundColor: active ? alpha(accent, 0.18) : colors.surfaceHigh,
          borderColor: active ? alpha(accent, 0.55) : colors.hairline,
          opacity: disabled ? 0.3 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={active ? accent : colors.textMuted} />
      <Text variant="caption" color={active ? accent : colors.textMuted}>
        {label}
      </Text>
    </Touchable>
  );
}

export function ToolDock({
  accent,
  active,
  values,
  maxLayer,
  xray,
  running,
  animatable,
  onSelectTool,
  onChange,
  onToggleXray,
  onToggleRun,
  cutAxis,
  onCutAxis,
  onFlipCut,
  layerFocus,
  onLayerFocus,
}: {
  accent: string;
  active: ToolId | null;
  values: ToolValues;
  maxLayer: number;
  xray: boolean;
  running: boolean;
  animatable: boolean;
  onSelectTool: (tool: ToolId | null) => void;
  onChange: (tool: ToolId, value: number) => void;
  onToggleXray: () => void;
  onToggleRun: () => void;
  cutAxis: 'x' | 'y' | 'z';
  onCutAxis: (axis: 'x' | 'y' | 'z') => void;
  onFlipCut: () => void;
  layerFocus: number | null;
  onLayerFocus: (layer: number | null) => void;
}) {
  const colors = useColors();
  const t = useT();
  const layerSteps = maxLayer + 1;

  return (
    <View style={styles.dock}>
      {active ? (
        <View style={[styles.sliderRow, { backgroundColor: colors.floating, borderColor: colors.hairline }]}>
          {active === 'peel' ? (
            <Slider
              accent={accent}
              label={t('tool.peelAway')}
              hint={
                values.peel === 0 ? t('tool.complete') : t('tool.removed', { count: Math.round(values.peel * maxLayer) })
              }
              value={values.peel}
              steps={layerSteps}
              onChange={(value) => onChange('peel', value)}
            />
          ) : (
            <>
              <Slider
                accent={accent}
                label={active === 'explode' ? t('tool.separate') : t('tool.crossSection')}
                hint={`${Math.round(values[active] * 100)}%`}
                value={values[active]}
                onChange={(value) => onChange(active, value)}
              />
              {active === 'cut' ? (
                <View style={styles.axisRow}>
                  <Text variant="caption" color={colors.textFaint}>
                    {t('tool.sliceAlong')}
                  </Text>
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <Touchable
                      key={axis}
                      onPress={() => onCutAxis(axis)}
                      accessibilityRole="button"
                      accessibilityLabel={`Cut along the ${axis} axis`}
                      accessibilityState={{ selected: cutAxis === axis }}
                      style={[
                        styles.axis,
                        {
                          backgroundColor: cutAxis === axis ? alpha(accent, 0.2) : colors.surfaceHigh,
                          borderColor: cutAxis === axis ? alpha(accent, 0.6) : colors.hairline,
                        },
                      ]}
                    >
                      <Text variant="caption" color={cutAxis === axis ? accent : colors.textMuted}>
                        {axis.toUpperCase()}
                      </Text>
                    </Touchable>
                  ))}
                  <Touchable
                    onPress={onFlipCut}
                    accessibilityRole="button"
                    accessibilityLabel={t('tool.flip')}
                    style={[styles.axis, { backgroundColor: colors.surfaceHigh, borderColor: colors.hairline, flexDirection: 'row', gap: 5 }]}
                  >
                    <Ionicons name="swap-horizontal-outline" size={13} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>
                      {t('tool.flip')}
                    </Text>
                  </Touchable>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {maxLayer > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tools}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="caption" color={colors.textFaint} style={{ alignSelf: 'center', marginRight: 2 }}>
            {t('tool.focus')}
          </Text>
          {[null, ...Array.from({ length: maxLayer + 1 }, (_, i) => i)].map((layer) => {
            const active = layerFocus === layer;
            const label =
              layer === null
                ? t('tool.all')
                : layer === 0
                  ? t('tool.outer')
                  : layer === maxLayer
                    ? t('tool.core')
                    : t('tool.layer', { n: layer });
            return (
              <Touchable
                key={String(layer)}
                onPress={() => onLayerFocus(active ? null : layer)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.layer,
                  {
                    backgroundColor: active ? alpha(accent, 0.18) : colors.surfaceHigh,
                    borderColor: active ? alpha(accent, 0.55) : colors.hairline,
                  },
                ]}
              >
                <Text variant="caption" color={active ? accent : colors.textMuted}>
                  {label}
                </Text>
              </Touchable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tools}
        keyboardShouldPersistTaps="handled"
      >
        {TOOLS.map((tool) => (
          <ToolButton
            key={tool.id}
            label={t(`tool.${tool.id}`)}
            icon={tool.icon}
            accent={accent}
            active={active === tool.id || values[tool.id] > 0}
            disabled={tool.id === 'peel' && maxLayer === 0}
            onPress={() => onSelectTool(active === tool.id ? null : tool.id)}
          />
        ))}
        <ToolButton label={t('tool.xray')} icon="eye-outline" accent={accent} active={xray} onPress={onToggleXray} />
        <ToolButton
          label={running ? t('tool.pause') : t('tool.run')}
          icon={running ? 'pause-outline' : 'play-outline'}
          accent={accent}
          active={running}
          disabled={!animatable}
          onPress={onToggleRun}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { gap: space.md },
  sliderRow: {
    marginHorizontal: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tools: { gap: space.sm, paddingHorizontal: space.lg, alignItems: 'center' },
  axisRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  axis: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
