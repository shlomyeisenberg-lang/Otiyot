// The lesson screen (#/lesson, T13): where the practice slate and the map's "learn it first"
// lead. It types one lesson of the active track on the parchment, with the paper strip, the
// keyboard guide and the hint coach, and records it: passing adds the lesson to the track's
// progress (which opens new keys and new regions), every key feeds the adaptive engine, and a
// statistics-only history entry is written. Enter goes on to the next lesson; Esc goes home.
// Practice modes (T31) will add more ways to drill; this is the course itself.

import { cleanText } from '../../learn/content';
import {
  contextFor,
  findNextLesson,
  getProgress,
  getTrack,
  knownKeysOf,
  recordKeystroke,
  recordLessonResult,
  type Lesson,
} from '../../learn';
import type { TypedKey } from '../../core';
import type { AppContext, Screen } from '../app';
import { button, keycap, statTile, status } from '../components';
import { h } from '../dom';
import { PlayController, type RunEnd } from '../play';
import { takeWantedLesson } from '../playable';

interface LessonProbe {
  lessonId: string | null;
  title: string;
  word: string;
  nextKey: string | null;
  nextShift: string | null;
  ended: boolean;
  passed: boolean | null;
  newKeys: string;
}

declare global {
  interface Window {
    __otiyotLesson?: LessonProbe;
  }
}

/** Finds a lesson of the active track by id. */
function lessonById(ctx: AppContext, id: string): Lesson | null {
  const p = ctx.profile;
  const track = getTrack(p.track);
  for (const lvl of track.levels(p.layout, p.settings.uiLanguage)) {
    const l = track.lessons(lvl.id, p.layout, p.settings.uiLanguage).find((x) => x.id === id);
    if (l) return l;
  }
  return null;
}

export function lessonScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const profile = ctx.profile;
  const settings = profile.settings;
  const probe: LessonProbe = {
    lessonId: null,
    title: '',
    word: '',
    nextKey: null,
    nextShift: null,
    ended: false,
    passed: null,
    newKeys: '',
  };
  window.__otiyotLesson = probe;

  const play = new PlayController(t, profile.layout, settings, settings.keyboardGuide);
  const title = h('h1', { class: 'lesson__title' });
  const tip = h('p', { class: 'lesson__tip' });
  const head = h(
    'header',
    { class: 'lesson__head' },
    h('p', { class: 'lesson__kicker', text: t.t('lesson.kicker') }),
    title,
    tip,
  );
  const done = h('div', { class: 'lesson__done', hidden: true, role: 'dialog' });
  const view = h('div', { class: 'lesson__view' }, play.hud.el);
  const el = h(
    'section',
    { class: 'lesson', 'data-testid': 'lesson', 'aria-label': t.t('lesson.label') },
    head,
    view,
    done,
  );

  let lesson: Lesson | null = null;
  let keys: TypedKey[] = [];
  let raf = 0;
  let disposed = false;

  const sync = (): void => {
    const d = play.current;
    probe.word = d?.word ?? '';
    const g = d?.guide() ?? null;
    probe.nextKey = g?.code ?? null;
    probe.nextShift = g?.shift ?? null;
    probe.ended = d?.ended ?? false;
  };

  function begin(id: string | null): void {
    done.hidden = true;
    const p = ctx.profile;
    const track = getTrack(p.track);
    const next =
      (id ? lessonById(ctx, id) : null) ??
      findNextLesson(track, p.layout, p.settings.uiLanguage, getProgress(p).completed)?.lesson ??
      null;
    lesson = next;
    keys = [];
    probe.passed = null;
    probe.newKeys = '';
    if (!next) {
      probe.lessonId = null;
      title.textContent = t.t('lesson.allDone');
      tip.textContent = '';
      showEnd(null);
      return;
    }
    probe.lessonId = next.id;
    probe.title = next.title;
    title.textContent = next.title;
    tip.textContent = next.tip ?? '';
    const text = cleanText(next.text(contextFor(p)), p.layout);
    play.begin({ next: () => text }, 'once', p.layout);
    sync();
  }

  play.onJudged = (k) => {
    keys.push(k);
    sync();
  };

  play.onEnd = (end) => {
    sync();
    finish(end);
  };

  function finish(end: RunEnd): void {
    const l = lesson;
    if (!l) return;
    const before = knownKeysOf(ctx.profile);
    const m = end.metrics;
    let passed = false;
    const now = Date.now();
    ctx.saves.update((p) => {
      // Every key feeds the adaptive engine; only statistics are kept, never the text.
      let prev: string | undefined;
      let at = 0;
      for (const k of keys) {
        const ms = Math.max(0, k.at - at);
        at = k.at;
        const r = recordKeystroke(
          p,
          { expected: k.expected, typed: k.typed, ms: prev === undefined ? 0 : ms, prev },
          now,
        );
        p.keys = r.keys;
        p.srs = r.srs;
        prev = k.expected;
      }
      passed = recordLessonResult(p, l.id, {
        wpm: m.netWpm,
        accuracy: m.accuracy,
        stars: m.accuracy >= 98 ? 3 : m.accuracy >= 94 ? 2 : m.accuracy >= 90 ? 1 : 0,
      }).passed;
      p.history.push({
        at: now,
        track: p.track,
        mode: `lesson:${l.id}`,
        wpm: Math.round(m.netWpm),
        accuracy: m.accuracy,
        durationMs: m.elapsedMs,
        chars: m.keystrokes,
      });
    });
    void ctx.saves.flush();
    const after = knownKeysOf(ctx.profile);
    probe.newKeys = [...after].filter((c) => !before.has(c)).join('');
    probe.passed = passed;
    ctx.audio.play(passed ? 'success' : 'ui-error');
    showEnd(end, passed, probe.newKeys);
  }

  function showEnd(end: RunEnd | null, passed = false, fresh = ''): void {
    const m = end?.metrics;
    const body: HTMLElement[] = [];
    if (m) {
      body.push(
        h(
          'p',
          { class: 'lesson__verdict' },
          status(t.t(passed ? 'lesson.passed' : 'lesson.again'), passed ? 'ok' : 'warn'),
        ),
        h(
          'div',
          { class: 'lesson__stats' },
          statTile({ label: t.t('hud.accuracy'), value: m.accuracy, unit: '%', gold: passed }),
          statTile({ label: t.t('hud.wpm'), value: Math.round(m.netWpm) }),
          statTile({ label: t.t('hud.combo'), value: end.bestCombo }),
        ),
      );
      if (fresh) {
        body.push(
          h(
            'p',
            { class: 'lesson__new' },
            t.t('lesson.newKeys'),
            ...Array.from(fresh).map((c) => keycap(c, 'gold')),
          ),
        );
      }
      if (!passed) body.push(h('p', { class: 'lesson__note', text: t.t('lesson.needs') }));
    } else {
      body.push(h('p', { class: 'lesson__note', text: t.t('lesson.allDoneBody') }));
    }
    const nextBtn = button({
      label: t.t(passed ? 'lesson.next' : 'lesson.retry'),
      variant: 'primary',
      onClick: () => begin(passed ? null : (lesson?.id ?? null)),
    });
    nextBtn.append(keycap('Enter', 'plain', 'sm'));
    const home = button({ label: t.t('lesson.home'), onClick: () => ctx.go('hub') });
    done.replaceChildren(
      h('h2', { class: 'lesson__done-title', text: t.t('lesson.doneTitle') }),
      ...body,
      h('div', { class: 'lesson__actions' }, ...(m ? [nextBtn] : []), home),
    );
    done.hidden = false;
    (m ? nextBtn : home).focus();
  }

  const tick = (now: number): void => {
    if (disposed) return;
    play.frame(now);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  begin(takeWantedLesson());

  return {
    el,
    full: true,
    onKey(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      if (!done.hidden) return false;
      if (ev.key === 'Enter' || ev.key === 'Tab') return false;
      const used = play.key(ev, performance.now());
      if (used) sync();
      return used;
    },
    focus() {
      el.focus?.();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      play.dispose();
    },
  };
}
