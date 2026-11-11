// The sound room (#/sound, from Settings > Sound): hear every music theme, watch its layers come in
// as a streak grows, try the boss phases, the place sounds and every effect. Typing any letter
// here plays the key click and counts a streak, exactly as in play; Backspace is a mistake.

import {
  AMBIENCE_IDS,
  AudioEngine,
  LAYER_AT,
  SFX_NAMES,
  STEMS,
  THEME_IDS,
  THEMES,
  type AmbienceHandle,
  type AmbienceId,
  type ThemeId,
} from '../../audio';
import { comboTier } from '../../game/typing';
import type { AppContext, Screen } from '../app';
import { button, slider } from '../components';
import { h } from '../dom';
import type { MessageKey } from '../i18n';
import { frame } from './frame';

interface SoundProbe {
  status: () => AudioEngine['status'];
  render: typeof AudioEngine.render;
  combo: number;
}

declare global {
  interface Window {
    __otiyotSound?: SoundProbe;
  }
}

let lastTheme: ThemeId = 'title';

export function soundScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const audio = ctx.audio;
  let theme: ThemeId = lastTheme;
  let combo = 0;
  let tier = 0;
  let stopped = false;
  const running = new Map<AmbienceId, AmbienceHandle>();
  const probe: SoundProbe = {
    status: () => audio.status,
    render: (id, seconds, intensity, rate) => AudioEngine.render(id, seconds, intensity, rate),
    combo: 0,
  };
  window.__otiyotSound = probe;

  // ---- music ---------------------------------------------------------------------------
  const themeButtons = THEME_IDS.map((id) => {
    const spec = THEMES[id];
    const b = h(
      'button',
      { class: 'sound__theme', type: 'button', role: 'radio', 'data-theme': id },
      h('span', { class: 'sound__theme-name', text: t.t(spec.nameKey as MessageKey) }),
      h('span', { class: 'sound__theme-mood', text: t.t(`sound.mood.${id}` as MessageKey) }),
      h('span', {
        class: 'sound__theme-meta',
        text: t.t('sound.meta', {
          bpm: spec.bpm,
          mode: t.t(`sound.mode.${spec.mode}` as MessageKey),
        }),
      }),
    );
    b.addEventListener('click', () => pickTheme(id));
    return b;
  });
  const themeRow = h(
    'div',
    { class: 'sound__themes', role: 'radiogroup', 'aria-label': t.t('sound.music') },
    ...themeButtons,
  );

  // In the order they come in as a streak grows.
  const order = [...STEMS].sort((a, b) => LAYER_AT[a] - LAYER_AT[b]);
  const lamps = order.map((id) =>
    h(
      'span',
      { class: 'sound__lamp', 'data-stem': id },
      h('span', { class: 'sound__lamp-dot', 'aria-hidden': 'true' }),
      h('span', { text: t.t(`sound.stem.${id}` as MessageKey) }),
    ),
  );
  const lampRow = h(
    'div',
    { class: 'sound__lamps', role: 'status', 'aria-label': t.t('sound.layers') },
    ...lamps,
  );

  const level = slider({
    min: 0,
    max: 4,
    step: 1,
    value: 0,
    format: (v) => t.t(`sound.tier.${v}` as MessageKey),
    onChange: (v) => setTier(v, false),
  });
  level.el.setAttribute('aria-label', t.t('sound.level'));

  const comboEl = h('strong', { class: 'sound__combo-n', text: '0' });
  const pad = h(
    'div',
    { class: 'sound__pad' },
    h('span', { class: 'sound__combo' }, comboEl, h('span', { text: t.t('sound.streak') })),
    h('p', { class: 'sound__pad-hint', text: t.t('sound.typeHere') }),
  );

  const phaseButtons = (['phase1', 'phase2', 'phase3', 'phase4'] as const).map((p, i) => {
    const b = button({
      label: t.t('sound.phase', { n: i + 1 }),
      small: true,
      onClick: () => {
        if (theme !== 'boss') pickTheme('boss');
        audio.section(p);
      },
    });
    b.dataset.phase = p;
    return b;
  });

  const stop = button({
    label: t.t('sound.stop'),
    variant: 'quiet',
    small: true,
    onClick: () => {
      audio.music(null);
      stopped = true;
      paint();
    },
  });
  stop.dataset.action = 'stop';

  // ---- places and effects ----------------------------------------------------------------
  const ambButtons = AMBIENCE_IDS.map((id) => {
    const b = h('button', {
      class: 'sound__chip',
      type: 'button',
      'aria-pressed': 'false',
      'data-ambience': id,
      text: t.t(`sound.amb.${id}` as MessageKey),
    });
    b.addEventListener('click', () => {
      const on = running.get(id);
      if (on) {
        on.stop();
        running.delete(id);
      } else {
        audio.unlock();
        running.set(id, audio.ambience(id));
      }
      b.setAttribute('aria-pressed', String(running.has(id)));
    });
    return b;
  });

  const sfxButtons = SFX_NAMES.map((name) => {
    const b = h('button', {
      class: 'sound__chip',
      type: 'button',
      'data-sfx': name,
      text: t.t(`sound.sfx.${name}` as MessageKey),
    });
    b.addEventListener('click', (ev) => {
      ev.stopPropagation(); // No menu click on top of the effect itself.
      audio.unlock();
      if (name === 'key') audio.play('key', combo, 'a');
      else if (name === 'tier') audio.play('tier', Math.max(1, tier));
      else audio.play(name);
    });
    return b;
  });

  const section = (title: MessageKey, ...children: HTMLElement[]): HTMLElement =>
    h(
      'section',
      { class: 'sound__section' },
      h('h2', { class: 'sound__h', text: t.t(title) }),
      ...children,
    );

  const el = frame(
    { title: t.t('sound.title'), lead: t.t('sound.lead') },
    h(
      'div',
      { class: 'sound' },
      section(
        'sound.music',
        themeRow,
        h(
          'div',
          { class: 'sound__level' },
          h('label', { class: 'sound__label', text: t.t('sound.level') }),
          level.el,
          level.value,
        ),
        lampRow,
        pad,
        h('div', { class: 'sound__row' }, ...phaseButtons, stop),
      ),
      section('sound.places', h('div', { class: 'sound__chips' }, ...ambButtons)),
      section('sound.effects', h('div', { class: 'sound__chips' }, ...sfxButtons)),
    ),
  );

  // ---- behaviour -------------------------------------------------------------------------
  function pickTheme(id: ThemeId): void {
    theme = id;
    lastTheme = id;
    stopped = false;
    audio.unlock();
    audio.music(id);
    audio.intensity(tier / 4);
    paint();
  }

  function setTier(v: number, fromTyping: boolean): void {
    const next = Math.max(0, Math.min(4, Math.round(v)));
    if (fromTyping && next > tier) audio.play('tier', next);
    tier = next;
    audio.intensity(tier / 4);
    if (Number(level.el.value) !== tier) {
      level.el.value = String(tier);
      level.el.dispatchEvent(new Event('input'));
    }
  }

  function paint(): void {
    const st = audio.status;
    for (const b of themeButtons) {
      b.setAttribute('aria-checked', String(!stopped && b.dataset.theme === theme));
    }
    for (const lamp of lamps) {
      const id = lamp.dataset.stem as (typeof STEMS)[number];
      // Before the first key press nothing sounds yet, but the lamps show what will.
      const on = !stopped && st.stems[id] > 0;
      lamp.classList.toggle('is-on', on);
    }
    comboEl.textContent = String(combo);
    probe.combo = combo;
  }

  const timer = window.setInterval(paint, 200);
  audio.music(theme);
  audio.intensity(0);
  paint();

  return {
    el,
    wide: true,
    ownsMusic: true,
    onKey(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      if (ev.key === 'Backspace') {
        audio.play('error');
        combo = 0;
        setTier(0, true);
        paint();
        return true;
      }
      if (ev.key === ' ') {
        audio.play('space');
        if (combo > 0 && combo % 5 === 0) audio.play('word');
        return true;
      }
      if (ev.key.length === 1 && /\p{L}/u.test(ev.key)) {
        combo += 1;
        audio.play('key', combo, ev.key);
        setTier(comboTier(combo), true);
        paint();
        return true;
      }
      return false;
    },
    focus: () =>
      themeButtons.find((b) => b.dataset.theme === theme)?.focus({ preventScroll: true }),
    dispose() {
      window.clearInterval(timer);
      for (const a of running.values()) a.stop();
      running.clear();
      if (window.__otiyotSound === probe) delete window.__otiyotSound;
    },
  };
}
