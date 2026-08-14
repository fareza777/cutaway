/**
 * The mark on a library card.
 *
 * Rendering a real thumbnail would mean booting a GL context per card, so each
 * category gets a geometric motif built from plain Views instead: layers for
 * electronics, concentric rings for anything that spins, a stack of bars for
 * mechanical assemblies. It costs nothing, scales to any accent colour, and
 * stays sharp at any density.
 */

import { StyleSheet, View } from 'react-native';

import { alpha } from './theme';

const SIZE = 74;

function Rings({ accent }: { accent: string }) {
  return (
    <View style={styles.centre}>
      {[1, 0.72, 0.46, 0.22].map((scale, index) => (
        <View
          key={scale}
          style={[
            styles.ring,
            {
              width: SIZE * scale,
              height: SIZE * scale,
              borderRadius: (SIZE * scale) / 2,
              borderColor: alpha(accent, 0.85 - index * 0.16),
              borderWidth: index === 3 ? SIZE * 0.11 : 1.5,
            },
          ]}
        />
      ))}
    </View>
  );
}

function Layers({ accent }: { accent: string }) {
  return (
    <View style={[styles.centre, { transform: [{ rotate: '-18deg' }] }]}>
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            width: SIZE * 0.62,
            height: SIZE * 0.16,
            borderRadius: 4,
            top: index * SIZE * 0.19 - SIZE * 0.28,
            backgroundColor: index === 1 ? alpha(accent, 0.9) : 'transparent',
            borderWidth: 1.5,
            borderColor: alpha(accent, 0.75 - index * 0.13),
          }}
        />
      ))}
    </View>
  );
}

function Piston({ accent }: { accent: string }) {
  return (
    <View style={styles.centre}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: SIZE * 0.46,
          height: SIZE * 0.3,
          borderRadius: 5,
          borderWidth: 1.5,
          borderColor: alpha(accent, 0.85),
          backgroundColor: alpha(accent, 0.28),
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: SIZE * 0.3,
          width: 3,
          height: SIZE * 0.3,
          backgroundColor: alpha(accent, 0.8),
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: SIZE * 0.5,
          height: SIZE * 0.5,
          borderRadius: SIZE * 0.25,
          borderWidth: 1.5,
          borderColor: alpha(accent, 0.6),
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: SIZE * 0.34,
          width: SIZE * 0.16,
          height: SIZE * 0.16,
          borderRadius: SIZE * 0.08,
          backgroundColor: alpha(accent, 0.95),
        }}
      />
    </View>
  );
}

/** A box with a drum in it — the shape most appliances actually are. */
function Appliance({ accent }: { accent: string }) {
  return (
    <View style={styles.centre}>
      <View
        style={{
          position: 'absolute',
          width: SIZE * 0.78,
          height: SIZE * 0.92,
          borderRadius: 8,
          borderWidth: 1.5,
          borderColor: alpha(accent, 0.75),
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: SIZE * 0.46,
          height: SIZE * 0.46,
          borderRadius: SIZE * 0.23,
          borderWidth: 1.5,
          borderColor: alpha(accent, 0.9),
          backgroundColor: alpha(accent, 0.16),
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: SIZE * 0.2,
          height: SIZE * 0.2,
          borderRadius: SIZE * 0.1,
          backgroundColor: alpha(accent, 0.85),
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: SIZE * 0.06,
          width: SIZE * 0.5,
          height: 4,
          borderRadius: 2,
          backgroundColor: alpha(accent, 0.5),
        }}
      />
    </View>
  );
}

const MOTIFS: Record<string, (props: { accent: string }) => React.ReactElement> = {
  Aerospace: Rings,
  Mechanical: Piston,
  Appliances: Appliance,
};

export function ObjectGlyph({ category, accent }: { category: string; accent: string }) {
  const Motif = MOTIFS[category] ?? Layers;
  return (
    <View style={[styles.frame, { backgroundColor: alpha(accent, 0.07), borderColor: alpha(accent, 0.16) }]}>
      <Motif accent={accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: SIZE + 26,
    height: SIZE + 26,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centre: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
});
