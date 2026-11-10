// Runs the ORIGINAL plugin code (reference/, read-only) in a sandbox so the ports can be
// compared with it. Test-only helper: nothing in src/ imports from here or from reference/.
import fs from 'node:fs';
import vm from 'node:vm';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OriginalLesson {
  id: string;
  title: string;
  tip?: string;
  keyCode?: string;
  keyCodes?: string[];
  niqud?: boolean;
  gen(): string;
}

export interface OriginalState {
  lang: 'he' | 'en';
  ui: 'he' | 'en';
  practiceLength: number;
  completed: string[];
  activeLevel: number;
  weakChars: string[];
  weakBigrams: string[];
  difficulty: number;
}

export interface Original {
  state: OriginalState;
  seed(n: number): void;
  levels(): { id: number; name: string; desc: string }[];
  lessons(levelId: number): OriginalLesson[];
  unlocked(levelId: number, idx: number): boolean;
  next(): { levelId: number; lessonId: string } | null;
  exercise(level: number): string;
}

const FINGER_HE: Record<string, string> = {
  lp: 'זרת שמאל',
  lr: 'קמיצה שמאל',
  lm: 'אמה שמאל',
  li: 'אצבע שמאל',
  ri: 'אצבע ימין',
  rm: 'אמה ימין',
  rr: 'קמיצה ימין',
  rp: 'זרת ימין',
  th: 'אגודל',
};

export function loadOriginal(version: '3.3.0' | '4.2.0'): Original {
  const dir = `reference/plugin-${version}/js/`;
  const state: OriginalState = {
    lang: 'he',
    ui: 'he',
    practiceLength: 50,
    completed: [],
    activeLevel: 0,
    weakChars: [],
    weakBigrams: [],
    difficulty: 0.3,
  };
  let rnd: () => number = mulberry32(1);
  const sandbox: Record<string, unknown> = {
    console,
    Intl,
    __rnd: () => rnd(),
    __state: state,
  };
  const ctx = vm.createContext(sandbox);
  const run = (code: string) => vm.runInContext(code, ctx);
  run('Math.random = __rnd;');
  run(`
    const appSettings = { get englishTypingEnabled() { return __state.lang === 'en'; },
      get uiLang() { return __state.ui; }, get practiceLength() { return __state.practiceLength; } };
    const appData = { charStats: {}, bigramStats: {}, wordStats: {}, progress: {},
      pedagogy: { get challenge() { return { level: __state.difficulty, recent: '', n: 0 }; } } };
    function getCompletedLessons() { return __state.completed; }
    function getActiveLevel() { return __state.activeLevel; }
    function getActiveLanguage() { return __state.lang; }
    function getLessonBest() { return null; }
  `);
  run(`const __FN = ${JSON.stringify(FINGER_HE)};
    function fingerName(code) {
      if (appSettings.uiLang === 'en') {
        return ({ lp: 'Left pinky', lr: 'Left ring', lm: 'Left middle', li: 'Left index', ri: 'Right index',
          rm: 'Right middle', rr: 'Right ring', rp: 'Right pinky', th: 'Thumb' })[code] || '';
      }
      return __FN[code] || '';
    }`);
  const files = [
    'constants.js',
    ...(version === '4.2.0' ? ['lexicon.js'] : []),
    'adaptive.js',
    'lessons.js',
  ];
  for (const f of files) run(fs.readFileSync(dir + f, 'utf8'));
  // The adaptive engine (T06) will supply these; the sandbox feeds in fixed lists instead.
  run(`getWeakCharacters = (n) => __state.weakChars.slice(0, n).map((ch) => ({ ch }));
    getWeakBigrams = (n) => __state.weakBigrams.slice(0, n).map((bg) => ({ bg }));`);
  // Make top-level declarations reachable from outside the sandbox.
  run(`globalThis.__api = { getCurrentLevels, buildLessonList, isLessonUnlocked, findNextLesson,
    generateAdaptiveExercise };`);
  const api = sandbox.__api as {
    getCurrentLevels(): { id: number; name: string; desc: string }[];
    buildLessonList(l: number): OriginalLesson[];
    isLessonUnlocked(l: number, id: string, lessons: OriginalLesson[], i: number): boolean;
    findNextLesson(): { levelId: number; lesson: OriginalLesson } | null;
    generateAdaptiveExercise(l: number): string;
  };
  return {
    state,
    seed(n) {
      rnd = mulberry32(n);
    },
    levels: () => api.getCurrentLevels().map(({ id, name, desc }) => ({ id, name, desc })),
    lessons: (l) => api.buildLessonList(l),
    unlocked(l, i) {
      const lessons = api.buildLessonList(l);
      return api.isLessonUnlocked(l, (lessons[i] as OriginalLesson).id, lessons, i);
    },
    next() {
      const n = api.findNextLesson();
      return n ? { levelId: n.levelId, lessonId: n.lesson.id } : null;
    },
    exercise: (l) => api.generateAdaptiveExercise(l),
  };
}
