/**
 * The library index.
 *
 * Metro needs static `require` calls to bundle an asset, so adding an object
 * means adding one row here. That is the entire registration step — everything
 * else is read out of the JSON and the .glb.
 */

import type { LibraryItem, ObjectDoc } from './types';
import { summarise } from './types';
import { localiseDoc, type ObjectTranslation } from './localise';
import type { Locale } from '@/i18n/strings';

type Entry = {
  doc: ObjectDoc;
  model: number;
  icon: number;
  translations: Record<Exclude<Locale, 'en'>, ObjectTranslation>;
};

export type { LibraryItem } from './types';

const ENTRIES: Entry[] = [
  {
    doc: require('../../content/smartphone.json') as ObjectDoc,
    model: require('../../assets/models/smartphone.glb'),
    icon: require('../../assets/object-icons/smartphone.png'),
    translations: { id: require('../../content/id/smartphone.json') },
  },
  {
    doc: require('../../content/turbofan.json') as ObjectDoc,
    model: require('../../assets/models/turbofan.glb'),
    icon: require('../../assets/object-icons/turbofan.png'),
    translations: { id: require('../../content/id/turbofan.json') },
  },
  {
    doc: require('../../content/turboshaft-helicopter.json') as ObjectDoc,
    model: require('../../assets/models/turboshaft_helicopter.glb'),
    icon: require('../../assets/object-icons/turboshaft-helicopter.png'),
    translations: { id: require('../../content/id/turboshaft-helicopter.json') },
  },
  {
    doc: require('../../content/earth-observation-satellite.json') as ObjectDoc,
    model: require('../../assets/models/earth_observation_satellite.glb'),
    icon: require('../../assets/object-icons/earth-observation-satellite.png'),
    translations: { id: require('../../content/id/earth-observation-satellite.json') },
  },
  {
    doc: require('../../content/piston-engine.json') as ObjectDoc,
    model: require('../../assets/models/piston_engine.glb'),
    icon: require('../../assets/object-icons/piston-engine.png'),
    translations: { id: require('../../content/id/piston-engine.json') },
  },
  {
    doc: require('../../content/refrigerator.json') as ObjectDoc,
    model: require('../../assets/models/refrigerator.glb'),
    icon: require('../../assets/object-icons/refrigerator.png'),
    translations: { id: require('../../content/id/refrigerator.json') },
  },
  {
    doc: require('../../content/washing-machine.json') as ObjectDoc,
    model: require('../../assets/models/washing_machine.glb'),
    icon: require('../../assets/object-icons/washing-machine.png'),
    translations: { id: require('../../content/id/washing-machine.json') },
  },
  {
    doc: require('../../content/rice-cooker.json') as ObjectDoc,
    model: require('../../assets/models/rice_cooker.glb'),
    icon: require('../../assets/object-icons/rice-cooker.png'),
    translations: { id: require('../../content/id/rice-cooker.json') },
  },
  {
    doc: require('../../content/microwave.json') as ObjectDoc,
    model: require('../../assets/models/microwave.glb'),
    icon: require('../../assets/object-icons/microwave.png'),
    translations: { id: require('../../content/id/microwave.json') },
  },
  {
    doc: require('../../content/air-conditioner.json') as ObjectDoc,
    model: require('../../assets/models/air_conditioner.glb'),
    icon: require('../../assets/object-icons/air-conditioner.png'),
    translations: { id: require('../../content/id/air-conditioner.json') },
  },
  {
    doc: require('../../content/cyclonic-vacuum.json') as ObjectDoc,
    model: require('../../assets/models/cyclonic_vacuum.glb'),
    icon: require('../../assets/object-icons/cyclonic-vacuum.png'),
    translations: { id: require('../../content/id/cyclonic-vacuum.json') },
  },
  {
    doc: require('../../content/heart.json') as ObjectDoc,
    model: require('../../assets/models/heart.glb'),
    icon: require('../../assets/object-icons/heart.png'),
    translations: { id: require('../../content/id/heart.json') },
  },
  {
    doc: require('../../content/kidney.json') as ObjectDoc,
    model: require('../../assets/models/kidney.glb'),
    icon: require('../../assets/object-icons/kidney.png'),
    translations: { id: require('../../content/id/kidney.json') },
  },
  {
    doc: require('../../content/lung.json') as ObjectDoc,
    model: require('../../assets/models/lung.glb'),
    icon: require('../../assets/object-icons/lung.png'),
    translations: { id: require('../../content/id/lung.json') },
  },
  {
    doc: require('../../content/eye.json') as ObjectDoc,
    model: require('../../assets/models/eye.glb'),
    icon: require('../../assets/object-icons/eye.png'),
    translations: { id: require('../../content/id/eye.json') },
  },
  {
    doc: require('../../content/rocket-engine.json') as ObjectDoc,
    model: require('../../assets/models/rocket_engine.glb'),
    icon: require('../../assets/object-icons/rocket-engine.png'),
    translations: { id: require('../../content/id/rocket-engine.json') },
  },
  {
    doc: require('../../content/lock.json') as ObjectDoc,
    model: require('../../assets/models/lock.glb'),
    icon: require('../../assets/object-icons/lock.png'),
    translations: { id: require('../../content/id/lock.json') },
  },
  {
    doc: require('../../content/loudspeaker.json') as ObjectDoc,
    model: require('../../assets/models/loudspeaker.glb'),
    icon: require('../../assets/object-icons/loudspeaker.png'),
    translations: { id: require('../../content/id/loudspeaker.json') },
  },
  {
    doc: require('../../content/hard-disk.json') as ObjectDoc,
    model: require('../../assets/models/hard_disk.glb'),
    icon: require('../../assets/object-icons/hard-disk.png'),
    translations: { id: require('../../content/id/hard-disk.json') },
  },
  {
    doc: require('../../content/electric-motor.json') as ObjectDoc,
    model: require('../../assets/models/electric_motor.glb'),
    icon: require('../../assets/object-icons/electric-motor.png'),
    translations: { id: require('../../content/id/electric-motor.json') },
  },
  {
    doc: require('../../content/differential.json') as ObjectDoc,
    model: require('../../assets/models/differential.glb'),
    icon: require('../../assets/object-icons/differential.png'),
    translations: { id: require('../../content/id/differential.json') },
  },
  {
    doc: require('../../content/mechanical-watch.json') as ObjectDoc,
    model: require('../../assets/models/mechanical_watch.glb'),
    icon: require('../../assets/object-icons/mechanical-watch.png'),
    translations: { id: require('../../content/id/mechanical-watch.json') },
  },
  {
    doc: require('../../content/cordless-drill.json') as ObjectDoc,
    model: require('../../assets/models/cordless_drill.glb'),
    icon: require('../../assets/object-icons/cordless-drill.png'),
    translations: { id: require('../../content/id/cordless-drill.json') },
  },
  {
    doc: require('../../content/camera.json') as ObjectDoc,
    model: require('../../assets/models/camera.glb'),
    icon: require('../../assets/object-icons/camera.png'),
    translations: { id: require('../../content/id/camera.json') },
  },
  {
    doc: require('../../content/violin.json') as ObjectDoc,
    model: require('../../assets/models/violin.glb'),
    icon: require('../../assets/object-icons/violin.png'),
    translations: { id: require('../../content/id/violin.json') },
  },
  {
    doc: require('../../content/brain.json') as ObjectDoc,
    model: require('../../assets/models/brain.glb'),
    icon: require('../../assets/object-icons/brain.png'),
    translations: { id: require('../../content/id/brain.json') },
  },
  {
    doc: require('../../content/inner-ear.json') as ObjectDoc,
    model: require('../../assets/models/inner_ear.glb'),
    icon: require('../../assets/object-icons/inner-ear.png'),
    translations: { id: require('../../content/id/inner-ear.json') },
  },
  {
    doc: require('../../content/tooth.json') as ObjectDoc,
    model: require('../../assets/models/tooth.glb'),
    icon: require('../../assets/object-icons/tooth.png'),
    translations: { id: require('../../content/id/tooth.json') },
  },
];

const BY_ID = new Map(ENTRIES.map((entry) => [entry.doc.id, entry]));

/** Cached per locale — merging is cheap, but it runs on every screen render. */
const LOCALISED = new Map<string, ObjectDoc>();

function resolve(entry: Entry, locale: Locale): ObjectDoc {
  if (locale === 'en' || !entry.translations[locale]) return entry.doc;
  const key = `${locale}:${entry.doc.id}`;
  const cached = LOCALISED.get(key);
  if (cached) return cached;
  const merged = localiseDoc(entry.doc, entry.translations[locale]);
  LOCALISED.set(key, merged);
  return merged;
}

export function getLibrary(locale: Locale): LibraryItem[] {
  return ENTRIES.map((entry) => ({ ...summarise(resolve(entry, locale)), icon: entry.icon }));
}

/** Category keys stay in English — they are ids, and the UI translates them. */
export const categories: string[] = [...new Set(ENTRIES.map((entry) => entry.doc.category))].sort();

export function getDoc(id: string, locale: Locale = 'en'): ObjectDoc | undefined {
  const entry = BY_ID.get(id);
  return entry ? resolve(entry, locale) : undefined;
}

/** True when this object reads fully in the given locale. */
export function isTranslated(id: string, locale: Locale) {
  return locale === 'en' || Boolean(BY_ID.get(id)?.translations[locale]);
}

/** The Metro asset module id for an object's .glb. */
export function getModelAsset(id: string): number | undefined {
  return BY_ID.get(id)?.model;
}
