/**
 * The library index.
 *
 * Metro needs static `require` calls to bundle an asset, so adding an object
 * means adding one row here. That is the entire registration step — everything
 * else is read out of the JSON and the .glb.
 */

import type { ObjectDoc, ObjectSummary } from './types';
import { summarise } from './types';
import { localiseDoc, type Translations } from './localise';
import type { Locale } from '@/i18n/strings';

type Entry = { doc: ObjectDoc; model: number; translations: Translations };

const ENTRIES: Entry[] = [
  {
    doc: require('../../content/smartphone.json') as ObjectDoc,
    model: require('../../assets/models/smartphone.glb'),
    translations: { id: require('../../content/id/smartphone.json') },
  },
  {
    doc: require('../../content/turbofan.json') as ObjectDoc,
    model: require('../../assets/models/turbofan.glb'),
    translations: { id: require('../../content/id/turbofan.json') },
  },
  {
    doc: require('../../content/piston-engine.json') as ObjectDoc,
    model: require('../../assets/models/piston_engine.glb'),
    translations: { id: require('../../content/id/piston-engine.json') },
  },
  {
    doc: require('../../content/refrigerator.json') as ObjectDoc,
    model: require('../../assets/models/refrigerator.glb'),
    translations: { id: require('../../content/id/refrigerator.json') },
  },
  {
    doc: require('../../content/washing-machine.json') as ObjectDoc,
    model: require('../../assets/models/washing_machine.glb'),
    translations: { id: require('../../content/id/washing-machine.json') },
  },
  {
    doc: require('../../content/rice-cooker.json') as ObjectDoc,
    model: require('../../assets/models/rice_cooker.glb'),
    translations: { id: require('../../content/id/rice-cooker.json') },
  },
  {
    doc: require('../../content/microwave.json') as ObjectDoc,
    model: require('../../assets/models/microwave.glb'),
    translations: { id: require('../../content/id/microwave.json') },
  },
  {
    doc: require('../../content/air-conditioner.json') as ObjectDoc,
    model: require('../../assets/models/air_conditioner.glb'),
    translations: { id: require('../../content/id/air-conditioner.json') },
  },
  {
    doc: require('../../content/cyclonic-vacuum.json') as ObjectDoc,
    model: require('../../assets/models/cyclonic_vacuum.glb'),
    translations: { id: require('../../content/id/cyclonic-vacuum.json') },
  },
  {
    doc: require('../../content/heart.json') as ObjectDoc,
    model: require('../../assets/models/heart.glb'),
    translations: { id: require('../../content/id/heart.json') },
  },
  {
    doc: require('../../content/kidney.json') as ObjectDoc,
    model: require('../../assets/models/kidney.glb'),
    translations: { id: require('../../content/id/kidney.json') },
  },
  {
    doc: require('../../content/lung.json') as ObjectDoc,
    model: require('../../assets/models/lung.glb'),
    translations: { id: require('../../content/id/lung.json') },
  },
  {
    doc: require('../../content/eye.json') as ObjectDoc,
    model: require('../../assets/models/eye.glb'),
    translations: { id: require('../../content/id/eye.json') },
  },
  {
    doc: require('../../content/rocket-engine.json') as ObjectDoc,
    model: require('../../assets/models/rocket_engine.glb'),
    translations: { id: require('../../content/id/rocket-engine.json') },
  },
  {
    doc: require('../../content/lock.json') as ObjectDoc,
    model: require('../../assets/models/lock.glb'),
    translations: { id: require('../../content/id/lock.json') },
  },
  {
    doc: require('../../content/loudspeaker.json') as ObjectDoc,
    model: require('../../assets/models/loudspeaker.glb'),
    translations: { id: require('../../content/id/loudspeaker.json') },
  },
  {
    doc: require('../../content/hard-disk.json') as ObjectDoc,
    model: require('../../assets/models/hard_disk.glb'),
    translations: { id: require('../../content/id/hard-disk.json') },
  },
  {
    doc: require('../../content/electric-motor.json') as ObjectDoc,
    model: require('../../assets/models/electric_motor.glb'),
    translations: { id: require('../../content/id/electric-motor.json') },
  },
  {
    doc: require('../../content/differential.json') as ObjectDoc,
    model: require('../../assets/models/differential.glb'),
    translations: { id: require('../../content/id/differential.json') },
  },
  {
    doc: require('../../content/mechanical-watch.json') as ObjectDoc,
    model: require('../../assets/models/mechanical_watch.glb'),
    translations: { id: require('../../content/id/mechanical-watch.json') },
  },
  {
    doc: require('../../content/cordless-drill.json') as ObjectDoc,
    model: require('../../assets/models/cordless_drill.glb'),
    translations: { id: require('../../content/id/cordless-drill.json') },
  },
  {
    doc: require('../../content/camera.json') as ObjectDoc,
    model: require('../../assets/models/camera.glb'),
    translations: { id: require('../../content/id/camera.json') },
  },
  {
    doc: require('../../content/violin.json') as ObjectDoc,
    model: require('../../assets/models/violin.glb'),
    translations: { id: require('../../content/id/violin.json') },
  },
  {
    doc: require('../../content/brain.json') as ObjectDoc,
    model: require('../../assets/models/brain.glb'),
    translations: { id: require('../../content/id/brain.json') },
  },
  {
    doc: require('../../content/inner-ear.json') as ObjectDoc,
    model: require('../../assets/models/inner_ear.glb'),
    translations: { id: require('../../content/id/inner-ear.json') },
  },
  {
    doc: require('../../content/tooth.json') as ObjectDoc,
    model: require('../../assets/models/tooth.glb'),
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

export function getLibrary(locale: Locale): ObjectSummary[] {
  return ENTRIES.map((entry) => summarise(resolve(entry, locale)));
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
