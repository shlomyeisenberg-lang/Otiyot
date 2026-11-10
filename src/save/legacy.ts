// One-time import of the old Hebrew typing plugin's progress (storage key hebtyper_data_v2,
// see reference/plugin-4.2.0/js/storage.js). Only statistics are read; no typed text exists there.

import {
  cleanName,
  createProfile,
  MAX_HISTORY,
  type HistoryEntry,
  type KeyStat,
  type Profile,
} from './schema';

export const LEGACY_KEY = 'hebtyper_data_v2';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Returns a profile built from old plugin data, or null when there is nothing worth importing. */
export function legacyToProfile(raw: unknown, id: string, now: number): Profile | null {
  if (!isRec(raw)) return null;
  const charStats = isRec(raw.charStats) ? raw.charStats : {};
  const sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  const progress = isRec(raw.progress) ? raw.progress : {};
  const done = isRec(progress.completedLessonsByLanguage)
    ? progress.completedLessonsByLanguage
    : {};
  const heDone = Array.isArray(done.he)
    ? done.he
    : Array.isArray(progress.completedLessons)
      ? progress.completedLessons
      : [];
  const enDone = Array.isArray(done.en) ? done.en : [];
  if (
    Object.keys(charStats).length === 0 &&
    sessions.length === 0 &&
    heDone.length === 0 &&
    enDone.length === 0
  ) {
    return null;
  }

  const p = createProfile(id, cleanName('Imported'), now);

  for (const [ch, st] of Object.entries(charStats)) {
    if (!isRec(st) || ch.length === 0) continue;
    const attempts = n(st.attempts);
    if (attempts === 0) continue;
    const correct = Math.min(attempts, n(st.correct));
    const stat: KeyStat = {
      hits: correct,
      misses: attempts - correct,
      avgMs: correct > 0 ? Math.round(n(st.totalMs) / correct) : 0,
      lastSeen: n(st.lastSeen),
      ease: 2.5,
      due: 0,
      confusions: {},
    };
    p.keys[ch] = stat;
  }

  const strs = (a: unknown[]): string[] => a.filter((x): x is string => typeof x === 'string');
  if (heDone.length > 0) p.lessons['1'] = { completed: strs(heDone), best: {} };
  if (enDone.length > 0) p.lessons['2'] = { completed: strs(enDone), best: {} };

  const hist: HistoryEntry[] = [];
  for (const s of sessions) {
    if (!isRec(s)) continue;
    hist.push({
      at: n(s.timestamp) || n(s.date) || n(s.at),
      track: s.lang === 'en' ? 2 : 1,
      mode: typeof s.mode === 'string' ? s.mode : 'practice',
      wpm: n(s.netWpm) || n(s.wpm),
      accuracy: Math.min(100, n(s.accuracy)),
      durationMs: n(s.durationMs),
      chars: n(s.chars),
    });
  }
  p.history = hist.slice(-MAX_HISTORY);
  if (enDone.length > 0 && heDone.length === 0) {
    p.track = 2;
    p.layout = 'en';
  }
  return p;
}
