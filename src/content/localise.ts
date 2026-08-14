/**
 * Content translation, as an overlay.
 *
 * The English JSON stays the single source of structure — part ids, mesh
 * names, layers, explode vectors, quiz answers. A translation file carries only
 * the prose, keyed by the same ids, and is merged on top at read time. Adding a
 * language therefore adds files and changes no schema, and a half-finished
 * translation degrades to English line by line instead of breaking the object.
 */

import type { ObjectDoc } from './types';
import type { Locale } from '@/i18n/strings';

export type ObjectTranslation = {
  title?: string;
  subtitle?: string;
  summary?: string;
  scale?: string;
  /** Keyed by part id. */
  parts?: Record<string, { name?: string; short?: string; detail?: string }>;
  /** Positional — same order as the English steps. */
  steps?: { title?: string; body?: string }[];
  /** Positional. `choices` must keep the original order; `answer` is not translatable. */
  quiz?: { prompt?: string; choices?: string[]; explain?: string }[];
};

export type Translations = Partial<Record<Locale, ObjectTranslation>>;

export function localiseDoc(doc: ObjectDoc, translation: ObjectTranslation | undefined): ObjectDoc {
  if (!translation) return doc;

  return {
    ...doc,
    title: translation.title ?? doc.title,
    subtitle: translation.subtitle ?? doc.subtitle,
    summary: translation.summary ?? doc.summary,
    scale: translation.scale ?? doc.scale,
    parts: doc.parts.map((part) => {
      const t = translation.parts?.[part.id];
      return t ? { ...part, name: t.name ?? part.name, short: t.short ?? part.short, detail: t.detail ?? part.detail } : part;
    }),
    steps: doc.steps.map((step, index) => {
      const t = translation.steps?.[index];
      return t ? { ...step, title: t.title ?? step.title, body: t.body ?? step.body } : step;
    }),
    quiz: doc.quiz.map((question, index) => {
      const t = translation.quiz?.[index];
      if (!t) return question;
      if (question.type === 'choice') {
        return {
          ...question,
          prompt: t.prompt ?? question.prompt,
          // Only swap the choices when the count matches — `answer` is an index
          // into this array, and a translation with a different length would
          // silently mark the wrong option correct.
          choices: t.choices?.length === question.choices.length ? t.choices : question.choices,
          explain: t.explain ?? question.explain,
        };
      }
      return { ...question, prompt: t.prompt ?? question.prompt };
    }),
  };
}
