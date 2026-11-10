// Interface language: strings from locales/he.json and locales/en.json (bundled, no network),
// text direction, and helpers for text that mixes Hebrew and Latin.

import type { LayoutId } from '../core';
import en from '../../locales/en.json';
import he from '../../locales/he.json';

export type Lang = LayoutId;
export type Dir = 'rtl' | 'ltr';
export type MessageKey = keyof typeof en;
export type Vars = Readonly<Record<string, string | number>>;

export const LANGS: readonly Lang[] = ['he', 'en'];
export const MESSAGES: Readonly<Record<Lang, Readonly<Record<string, string>>>> = { he, en };

export function dirOf(lang: Lang): Dir {
  return lang === 'he' ? 'rtl' : 'ltr';
}

export function otherLang(lang: Lang): Lang {
  return lang === 'he' ? 'en' : 'he';
}

const FSI = '\u2068';
const PDI = '\u2069';
const STRONG_RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
const STRONG_LTR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

/** Direction of a piece of text, from its first strong character (null: digits/symbols only). */
export function textDir(text: string): Dir | null {
  for (const ch of text) {
    if (STRONG_RTL.test(ch)) return 'rtl';
    if (STRONG_LTR.test(ch)) return 'ltr';
  }
  return null;
}

/**
 * Wraps foreign text (a player's name, an English word in a Hebrew sentence) in Unicode isolates so
 * it cannot reorder the punctuation or numbers around it. Safe to nest; plain strings in, plain
 * strings out, so it also works in aria-labels and titles.
 */
export function isolate(text: string): string {
  return text.length === 0 ? '' : `${FSI}${text}${PDI}`;
}

/** Fills `{name}` slots. Every inserted value is isolated, because it may be in the other script. */
export function format(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name];
    return v === undefined ? whole : isolate(String(v));
  });
}

/** Looks a key up in one language, falling back to the other, then to the key itself. */
export function translate(lang: Lang, key: string, vars?: Vars): string {
  const text = MESSAGES[lang][key] ?? MESSAGES[otherLang(lang)][key] ?? key;
  return format(text, vars);
}

export type LangListener = (lang: Lang) => void;

/** The live interface language. One instance is shared by the whole UI. */
export class I18n {
  private current: Lang;
  private readonly listeners = new Set<LangListener>();

  constructor(lang: Lang = 'he') {
    this.current = lang;
  }

  get lang(): Lang {
    return this.current;
  }

  get dir(): Dir {
    return dirOf(this.current);
  }

  t(key: MessageKey, vars?: Vars): string {
    return translate(this.current, key, vars);
  }

  /** Sets the language and stamps `lang` and `dir` on the document root. */
  setLang(lang: Lang, root?: HTMLElement): void {
    const changed = lang !== this.current;
    this.current = lang;
    if (root) {
      root.lang = lang;
      root.dir = dirOf(lang);
    }
    if (changed) for (const fn of this.listeners) fn(lang);
  }

  onChange(fn: LangListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/**
 * A DOM node for text that may be in the other script (player names, typing samples). `<bdi>`
 * isolates it and lets the browser pick its direction; `lang` picks the right font fallback.
 */
export function bdi(text: string, doc: Document = document): HTMLElement {
  const node = doc.createElement('bdi');
  node.textContent = text;
  const d = textDir(text);
  if (d) node.lang = d === 'rtl' ? 'he' : 'en';
  return node;
}
