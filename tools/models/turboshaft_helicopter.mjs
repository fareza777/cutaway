// Four-seat light utility helicopter with a free-turbine power path.
// +Y is up, the fuselage and engine run along X, and the nose points toward -X.

import {
  THREE, TAU, part, pbr, box, roundedBox, cylinder, tube, torus, sphere, blob,
  curve, merge, place,
} from '../lib/geo.mjs';

function named(material, name) {
  material.name = name;
  return material;
}

const COMPOSITE = () => named(pbr('#d65b32', { metalness: 0.08, roughness: 0.46 }), 'orange painted composite');
const GLASS = () => {
  const material = named(pbr('#8bc9dc', { metalness: 0, roughness: 0.08 }), 'smoke blue cockpit glazing');
  material.transparent = true;
  material.opacity = 0.3;
  material.depthWrite = false;
  material.side = THREE.DoubleSide;
  return material;
};
const UPHOLSTERY = () => named(pbr('#293744', { metalness: 0.01, roughness: 0.78 }), 'charcoal upholstery fabric');
const SKID = () => named(pbr('#30363b', { metalness: 0.18, roughness: 0.68 }), 'rubber skid shoes and steel tubes');
const TITANIUM = () => named(pbr('#aab2b9', { metalness: 0.88, roughness: 0.3 }), 'satin titanium');
const STEEL = () => named(pbr('#77838d', { metalness: 0.9, roughness: 0.34 }), 'machined steel');
const DARK_STEEL = () => named(pbr('#39434b', { metalness: 0.82, roughness: 0.42 }), 'dark gearbox steel');
const HOT = () => named(pbr('#8b5d48', { metalness: 0.84, roughness: 0.4, emissive: '#7b2616', emissiveIntensity: 0.1 }), 'nickel hot-section alloy');
const ELECTRONICS = () => named(pbr('#244e47', { metalness: 0.12, roughness: 0.52 }), 'avionics electronics board');
const RUBBER = () => named(pbr('#181c20', { metalness: 0.01, roughness: 0.86 }), 'black control rubber');
const FUEL = () => named(pbr('#c4a35b', { metalness: 0.78, roughness: 0.36 }), 'titanium fuel system');
const MODEL_SHIFT = new THREE.Vector3(-1.286, -1.6905, 0.0107);

function cylinderX(rTop, rBottom, length, radial, pos, openEnded = false) {
  return cylinder(rTop, rBottom, length, radial, { pos, rot: [0, 0, Math.PI / 2] }, openEnded);
}

function cylinderZ(rTop, rBottom, length, radial, pos, openEnded = false) {
  return cylinder(rTop, rBottom, length, radial, { pos, rot: [Math.PI / 2, 0, 0] }, openEnded);
}

function ringAroundX(count, factory) {
  const geometries = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * TAU;
    geometries.push(factory(index, angle).rotateX(angle));
  }
  return merge(geometries);
}

function compressorStage(x, blades, radius) {
  return merge([
    cylinderX(0.19, 0.19, 0.045, 40, [x, 0, 0]),
    ringAroundX(blades, (_, angle) => box(0.04, radius * 0.52, 0.055, {
      pos: [x, radius * 0.67, 0],
      rot: [0, 0, angle % 0.2 - 0.1],
    })),
  ]);
}

function turbineStage(x, blades, radius, lean) {
  return merge([
    cylinderX(0.2, 0.2, 0.052, 40, [x, 0, 0]),
    ringAroundX(blades, () => box(0.045, radius * 0.48, 0.07, {
      pos: [x, radius * 0.68, 0],
      rot: [lean, 0, 0.08],
    })),
  ]);
}

function mainBlade(angle) {
  const shape = new THREE.Shape();
  shape.moveTo(0.18, -0.17);
  shape.lineTo(0.72, -0.23);
  shape.lineTo(5.22, -0.15);
  shape.quadraticCurveTo(5.48, -0.12, 5.55, 0.02);
  shape.quadraticCurveTo(5.45, 0.15, 5.18, 0.18);
  shape.lineTo(0.72, 0.22);
  shape.lineTo(0.18, 0.14);
  shape.closePath();
  const blade = new THREE.ExtrudeGeometry(shape, {
    depth: 0.075,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.018,
    bevelThickness: 0.014,
    curveSegments: 16,
  });
  blade.translate(0, 0, -0.0375);
  blade.rotateX(Math.PI / 2);
  blade.rotateY(angle);
  blade.translate(0, 3.15, 0);
  const root = roundedBox(0.72, 0.095, 0.28, 0.045, 2, { pos: [0.42, 3.15, 0] });
  root.rotateY(angle);
  return merge([blade, root]);
}

function tailBlade() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.03, -0.075);
  shape.lineTo(-0.24, -0.13);
  shape.lineTo(0.24, -0.13);
  shape.lineTo(1.03, -0.075);
  shape.lineTo(1.08, 0.05);
  shape.lineTo(0.24, 0.12);
  shape.lineTo(-0.24, 0.12);
  shape.lineTo(-1.08, 0.05);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.065,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.014,
    bevelThickness: 0.01,
    curveSegments: 10,
  });
  geometry.translate(0, 0, -0.0325);
  geometry.rotateZ(Math.PI / 4);
  geometry.translate(4.48, 2.28, 0.5);
  return geometry;
}

function airframeGeometry() {
  const details = [];
  // Reinforcing bands make the tapered boom read as load-bearing structure.
  for (let index = 0; index < 11; index += 1) {
    const x = 0.86 + index * 0.32;
    const radius = 0.45 - index * 0.027;
    details.push(torus(radius, 0.018, 36, 6, { pos: [x, 1.9, 0], rot: [0, Math.PI / 2, 0] }));
  }
  // Flush fasteners around the engine deck add scale without separate meshes.
  for (let row = 0; row < 3; row += 1) {
    for (let index = 0; index < 16; index += 1) {
      details.push(sphere(0.018, 8, {
        pos: [-0.28 + index * 0.1, 2.43 - row * 0.14, row === 1 ? -0.73 : 0.73],
        scale: [0.55, 0.55, 0.35],
      }));
    }
  }
  return merge([
    blob(1.78, 1.02, 1.0, 56, { pos: [-1.22, 1.42, 0] }),
    roundedBox(1.9, 0.62, 1.48, 0.18, 3, { pos: [0.18, 2.12, 0] }),
    cylinderX(0.5, 0.15, 3.9, 72, [2.55, 1.9, 0]),
    roundedBox(0.24, 1.3, 0.17, 0.07, 3, { pos: [4.3, 2.3, 0], rot: [0, 0, -0.13] }),
    roundedBox(0.52, 0.16, 0.42, 0.06, 2, { pos: [4.18, 1.88, 0] }),
    roundedBox(0.9, 0.12, 1.58, 0.045, 2, { pos: [-1.0, 0.47, 0] }),
    roundedBox(0.11, 0.9, 0.1, 0.035, 2, { pos: [-2.7, 1.38, 0.78], rot: [0, 0, -0.18] }),
    roundedBox(0.11, 0.9, 0.1, 0.035, 2, { pos: [-2.7, 1.38, -0.78], rot: [0, 0, -0.18] }),
    roundedBox(1.42, 0.1, 0.1, 0.035, 2, { pos: [-1.92, 2.2, 0.86], rot: [0, 0, 0.06] }),
    roundedBox(1.42, 0.1, 0.1, 0.035, 2, { pos: [-1.92, 2.2, -0.86], rot: [0, 0, 0.06] }),
    ...details,
  ]);
}

export default function turboshaftHelicopter() {
  const group = new THREE.Group();

  group.add(
    part('airframe_shell', airframeGeometry(), COMPOSITE()),

    part('cockpit_glazing', merge([
      roundedBox(0.12, 0.88, 1.28, 0.055, 3, { pos: [-2.78, 1.68, 0], rot: [0, 0, -0.16] }),
      roundedBox(1.48, 0.8, 0.045, 0.04, 3, { pos: [-1.9, 1.68, 0.985], rot: [0, 0, 0.08] }),
      roundedBox(1.48, 0.8, 0.045, 0.04, 3, { pos: [-1.9, 1.68, -0.985], rot: [0, 0, 0.08] }),
      roundedBox(0.7, 0.72, 0.042, 0.04, 3, { pos: [-0.84, 1.65, 0.98] }),
      roundedBox(0.7, 0.72, 0.042, 0.04, 3, { pos: [-0.84, 1.65, -0.98] }),
    ]), GLASS()),

    part('cabin_and_seats', merge([
      roundedBox(2.15, 0.12, 1.5, 0.045, 2, { pos: [-1.35, 0.66, 0] }),
      ...[-1.9, -0.8].flatMap((x) => [-0.43, 0.43].flatMap((z) => [
        roundedBox(0.62, 0.18, 0.54, 0.08, 2, { pos: [x, 1.02, z], rot: [0, 0, -0.04] }),
        roundedBox(0.18, 0.74, 0.54, 0.075, 2, { pos: [x + 0.22, 1.37, z], rot: [0, 0, -0.18] }),
        roundedBox(0.48, 0.12, 0.08, 0.035, 2, { pos: [x + 0.17, 0.82, z] }),
      ])),
      roundedBox(0.2, 0.78, 1.42, 0.06, 2, { pos: [-2.36, 1.1, 0], rot: [0, 0, -0.2] }),
    ]), UPHOLSTERY()),

    part('landing_skids', merge([
      roundedBox(3.25, 0.11, 0.13, 0.054, 3, { pos: [-1.02, 0.055, 0.85] }),
      roundedBox(3.25, 0.11, 0.13, 0.054, 3, { pos: [-1.02, 0.055, -0.85] }),
      ...[-1.8, -0.25].flatMap((x) => [
        curve([[x, 0.62, 0.58], [x - 0.05, 0.38, 0.72], [x, 0.12, 0.85]], 0.055, { segments: 42, radial: 10 }),
        curve([[x, 0.62, -0.58], [x - 0.05, 0.38, -0.72], [x, 0.12, -0.85]], 0.055, { segments: 42, radial: 10 }),
        cylinderZ(0.07, 0.07, 1.46, 14, [x, 0.61, 0]),
      ]),
      roundedBox(0.38, 0.055, 0.16, 0.027, 5, { pos: [-2.48, 0.112, 0.85] }),
      roundedBox(0.38, 0.055, 0.16, 0.027, 5, { pos: [-2.48, 0.112, -0.85] }),
    ]), SKID()),

    part('fuel_system', merge([
      cylinderZ(0.36, 0.36, 1.2, 48, [-0.18, 1.03, 0]),
      torus(0.36, 0.026, 48, 12, { pos: [-0.18, 1.03, 0.48], rot: [Math.PI / 2, 0, 0] }),
      torus(0.36, 0.026, 48, 12, { pos: [-0.18, 1.03, -0.48], rot: [Math.PI / 2, 0, 0] }),
      curve([[-0.18, 1.12, 0.5], [-0.05, 1.35, 0.48], [0.2, 1.6, 0.35], [0.38, 1.78, 0.2]], 0.032, { segments: 54, radial: 10 }),
      curve([[-0.18, 1.12, -0.5], [-0.05, 1.35, -0.48], [0.2, 1.6, -0.35], [0.38, 1.78, -0.2]], 0.032, { segments: 54, radial: 10 }),
    ]), FUEL()),

    part('avionics', merge([
      roundedBox(0.26, 0.62, 1.18, 0.05, 2, { pos: [-2.37, 1.33, 0], rot: [0, 0, -0.18] }),
      ...[-0.35, 0, 0.35].map((z) => roundedBox(0.5, 0.22, 0.24, 0.035, 2, { pos: [-0.68, 0.83, z] })),
      ...[-0.42, -0.14, 0.14, 0.42].map((z) => sphere(0.045, 10, { pos: [-2.53, 1.45, z], scale: [0.35, 1, 1] })),
    ]), ELECTRONICS()),

    part('engine_air_intake', merge([
      cylinderX(0.37, 0.29, 0.34, 64, [-0.25, 1.85, 0], true),
      torus(0.37, 0.045, 64, 14, { pos: [-0.42, 1.85, 0], rot: [0, Math.PI / 2, 0] }),
      ...Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * TAU;
        return box(0.18, 0.026, 0.026, {
          pos: [-0.39, 1.85 + Math.cos(angle) * 0.18, Math.sin(angle) * 0.18],
          rot: [angle, 0, 0],
        });
      }),
    ]), TITANIUM()),

    part('compressor', place(merge([
      cylinderX(0.08, 0.08, 0.5, 28, [0, 0, 0]),
      ...[-0.18, -0.09, 0, 0.09, 0.18].map((offset, index) => compressorStage(offset, 18 + index * 2, 0.31 - index * 0.008)),
      torus(0.32, 0.018, 64, 10, { pos: [-0.24, 0, 0], rot: [0, Math.PI / 2, 0] }),
      torus(0.3, 0.018, 64, 10, { pos: [0.24, 0, 0], rot: [0, Math.PI / 2, 0] }),
    ]), { pos: [0.18, 1.85, 0] }), TITANIUM()),

    part('combustor', place(merge([
      tube(0.31, 0.2, 0.36, 64, { rot: [0, 0, Math.PI / 2] }),
      ...Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * TAU;
        return cylinderX(0.035, 0.028, 0.28, 12, [0, Math.cos(angle) * 0.25, Math.sin(angle) * 0.25]);
      }),
      torus(0.31, 0.024, 64, 12, { pos: [-0.17, 0, 0], rot: [0, Math.PI / 2, 0] }),
      torus(0.29, 0.024, 64, 12, { pos: [0.17, 0, 0], rot: [0, Math.PI / 2, 0] }),
    ]), { pos: [0.58, 1.85, 0] }), HOT()),

    part('gas_generator_turbine', place(merge([
      cylinderX(0.075, 0.075, 0.3, 28, [0, 0, 0]),
      turbineStage(-0.075, 30, 0.29, 0.18),
      turbineStage(0.075, 28, 0.28, -0.16),
      torus(0.3, 0.02, 60, 10, { pos: [-0.14, 0, 0], rot: [0, Math.PI / 2, 0] }),
      torus(0.29, 0.02, 60, 10, { pos: [0.14, 0, 0], rot: [0, Math.PI / 2, 0] }),
    ]), { pos: [0.91, 1.85, 0] }), HOT()),

    part('power_turbine', place(merge([
      cylinderX(0.08, 0.08, 0.28, 28, [0, 0, 0]),
      turbineStage(-0.06, 32, 0.28, -0.2),
      turbineStage(0.06, 30, 0.27, 0.2),
      torus(0.29, 0.02, 60, 10, { pos: [-0.13, 0, 0], rot: [0, Math.PI / 2, 0] }),
      torus(0.28, 0.02, 60, 10, { pos: [0.13, 0, 0], rot: [0, Math.PI / 2, 0] }),
    ]), { pos: [1.2, 1.85, 0] }), TITANIUM()),

    part('exhaust', merge([
      curve([[1.31, 1.85, 0.2], [1.48, 1.88, 0.32], [1.62, 2.02, 0.5], [1.68, 2.2, 0.62]], 0.14, { segments: 60, radial: 18 }),
      curve([[1.31, 1.85, -0.2], [1.48, 1.88, -0.32], [1.62, 2.02, -0.5], [1.68, 2.2, -0.62]], 0.14, { segments: 60, radial: 18 }),
      torus(0.14, 0.018, 44, 10, { pos: [1.68, 2.2, 0.62], rot: [Math.PI / 2, 0, 0] }),
      torus(0.14, 0.018, 44, 10, { pos: [1.68, 2.2, -0.62], rot: [Math.PI / 2, 0, 0] }),
    ]), HOT()),

    part('engine_output_shaft', merge([
      cylinderX(0.075, 0.075, 1.3, 36, [0.68, 1.85, 0]),
      ...[0.16, 0.42, 0.94, 1.2].map((x) => torus(0.09, 0.018, 36, 10, { pos: [x, 1.85, 0], rot: [0, Math.PI / 2, 0] })),
    ]), STEEL()),

    part('main_transmission', merge([
      blob(0.5, 0.4, 0.43, 52, { pos: [0, 2.15, 0] }),
      cylinder(0.34, 0.42, 0.42, 56, { pos: [0, 2.37, 0] }),
      torus(0.38, 0.034, 56, 12, { pos: [0, 2.16, 0], rot: [Math.PI / 2, 0, 0] }),
      ...Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * TAU;
        return cylinder(0.025, 0.025, 0.12, 10, { pos: [Math.cos(angle) * 0.38, 2.37, Math.sin(angle) * 0.38] });
      }),
    ]), DARK_STEEL()),

    part('rotor_mast', merge([
      cylinder(0.105, 0.105, 1.04, 44, { pos: [0, 2.64, 0] }),
      ...[2.28, 2.48, 2.68, 2.9].map((y) => torus(0.13, 0.022, 44, 10, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] })),
    ]), STEEL()),

    part('swashplate', merge([
      torus(0.34, 0.045, 64, 14, { pos: [0, 2.86, 0], rot: [Math.PI / 2, 0, 0] }),
      torus(0.22, 0.032, 56, 12, { pos: [0, 2.82, 0], rot: [Math.PI / 2, 0, 0] }),
      cylinder(0.19, 0.19, 0.1, 48, { pos: [0, 2.84, 0], openEnded: true }),
      ...Array.from({ length: 3 }, (_, index) => {
        const angle = (index / 3) * TAU;
        return sphere(0.055, 16, { pos: [Math.cos(angle) * 0.34, 2.86, Math.sin(angle) * 0.34] });
      }),
    ]), TITANIUM()),

    part('pitch_links', merge(Array.from({ length: 3 }, (_, index) => {
      const angle = (index / 3) * TAU;
      return merge([
        curve([
          [Math.cos(angle) * 0.34, 2.86, Math.sin(angle) * 0.34],
          [Math.cos(angle) * 0.38, 3.0, Math.sin(angle) * 0.38],
          [Math.cos(angle) * 0.42, 3.13, Math.sin(angle) * 0.42],
        ], 0.026, { segments: 30, radial: 10 }),
        sphere(0.043, 14, { pos: [Math.cos(angle) * 0.34, 2.86, Math.sin(angle) * 0.34] }),
        sphere(0.043, 14, { pos: [Math.cos(angle) * 0.42, 3.13, Math.sin(angle) * 0.42] }),
      ]);
    })), STEEL()),

    part('rotor_hub', merge([
      cylinder(0.29, 0.29, 0.2, 56, { pos: [0, 3.15, 0] }),
      sphere(0.23, 24, { pos: [0, 3.22, 0], scale: [1, 0.7, 1] }),
      ...Array.from({ length: 3 }, (_, index) => {
        const angle = (index / 3) * TAU;
        const arm = roundedBox(0.72, 0.13, 0.24, 0.06, 2, { pos: [0.34, 3.15, 0] });
        arm.rotateY(angle);
        return arm;
      }),
      ...Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * TAU;
        return cylinder(0.022, 0.022, 0.16, 10, { pos: [Math.cos(angle) * 0.24, 3.23, Math.sin(angle) * 0.24] });
      }),
    ]), TITANIUM()),

    part('main_rotor_blades', merge([
      mainBlade(0),
      mainBlade((2 * Math.PI) / 3),
      mainBlade((4 * Math.PI) / 3),
    ]), COMPOSITE()),

    part('tail_drive_shaft', merge([
      cylinderX(0.052, 0.052, 4.2, 28, [2.3, 2.02, 0]),
      ...Array.from({ length: 12 }, (_, index) => torus(0.072, 0.015, 20, 6, {
        pos: [0.38 + index * 0.34, 2.02, 0], rot: [0, Math.PI / 2, 0],
      })),
    ]), STEEL()),

    part('tail_gearbox', merge([
      roundedBox(0.52, 0.6, 0.48, 0.11, 7, { pos: [4.45, 2.16, 0.12] }),
      cylinderZ(0.22, 0.22, 0.42, 44, [4.48, 2.28, 0.31]),
      torus(0.22, 0.026, 44, 10, { pos: [4.48, 2.28, 0.5] }),
      ...Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * TAU;
        return cylinderZ(0.02, 0.02, 0.1, 8, [4.48 + Math.cos(angle) * 0.22, 2.28 + Math.sin(angle) * 0.22, 0.49]);
      }),
    ]), DARK_STEEL()),

    part('tail_rotor_hub', merge([
      cylinderZ(0.18, 0.18, 0.34, 48, [4.48, 2.28, 0.5]),
      sphere(0.2, 32, { pos: [4.48, 2.28, 0.66], scale: [1, 1, 0.72] }),
      roundedBox(0.62, 0.16, 0.16, 0.06, 5, { pos: [4.48, 2.28, 0.55], rot: [0, 0, Math.PI / 4] }),
    ]), TITANIUM()),

    part('tail_rotor_blades', merge([
      tailBlade(),
      roundedBox(0.62, 0.18, 0.08, 0.055, 5, { pos: [4.48, 2.28, 0.51], rot: [0, 0, Math.PI / 4] }),
    ]), COMPOSITE()),

    part('cyclic_control', merge([
      curve([[-1.48, 0.78, 0.18], [-1.53, 1.0, 0.18], [-1.63, 1.27, 0.17], [-1.72, 1.43, 0.15]], 0.035, { segments: 46, radial: 12 }),
      roundedBox(0.12, 0.32, 0.14, 0.045, 5, { pos: [-1.76, 1.53, 0.15], rot: [0, 0, -0.22] }),
      sphere(0.08, 18, { pos: [-1.48, 0.78, 0.18] }),
    ]), RUBBER()),

    part('collective_control', merge([
      curve([[-1.18, 0.78, -0.5], [-1.3, 0.84, -0.54], [-1.5, 0.94, -0.56], [-1.7, 1.02, -0.56]], 0.038, { segments: 42, radial: 12 }),
      roundedBox(0.36, 0.13, 0.13, 0.045, 5, { pos: [-1.84, 1.08, -0.56], rot: [0, 0, -0.18] }),
      sphere(0.085, 18, { pos: [-1.18, 0.78, -0.5] }),
    ]), RUBBER()),

    part('control_linkages', merge([
      curve([[-1.48, 0.78, 0.18], [-1.0, 0.74, 0.12], [-0.42, 1.0, 0.08], [-0.2, 1.72, 0.06], [-0.18, 2.45, 0.08], [-0.22, 2.84, 0.1]], 0.024, { segments: 92, radial: 10 }),
      curve([[-1.18, 0.78, -0.5], [-0.82, 0.78, -0.42], [-0.3, 1.1, -0.25], [0.12, 1.8, -0.18], [0.18, 2.5, -0.15], [0.24, 2.84, -0.12]], 0.024, { segments: 92, radial: 10 }),
      curve([[-0.22, 2.84, 0.1], [0, 2.76, 0], [0.24, 2.84, -0.12]], 0.026, { segments: 34, radial: 10 }),
      ...[[-1.48, 0.78, 0.18], [-1.18, 0.78, -0.5], [-0.22, 2.84, 0.1], [0.24, 2.84, -0.12]].map((pos) => sphere(0.045, 14, { pos })),
    ]), STEEL()),
  );

  // Keep the authored bounds centred so preview and runtime rotations orbit the
  // aircraft rather than the old positive-X/positive-Y construction origin.
  group.traverse((node) => {
    if (node.isMesh) node.geometry.translate(MODEL_SHIFT.x, MODEL_SHIFT.y, MODEL_SHIFT.z);
  });

  return group;
}
