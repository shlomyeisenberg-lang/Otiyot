// The intro cutscene screen (T12): the opening of Act 1 played in the engine, with the dialogue
// box (portrait, speaker, the line typing itself out at the player's text speed, optional voice),
// letterbox bars, and a Skip button. Enter or Space continues; Esc skips. At the end (or on skip)
// the story remembers that the intro was seen and hands over to the House of the Scribe.
// Without 3D, the same story is told over the parchment, line by line.

import type { IntroScene } from '../../scenes/intro';
import { ACT_ONE, apprenticeLook, CAST, CutscenePlayer, INTRO, type Beat } from '../../story';
import { HUB, type AppContext, type Screen } from '../app';
import { button, dialogueBox, keycap } from '../components';
import { h } from '../dom';
import type { Stage3d } from '../stage3d';
import { StoryVoice } from '../voice';

/** How long the act card stays before the hand-over, after the last beat. */
const HANDOVER_MS = 400;

interface IntroProbe {
  ready: boolean;
  beat: string;
  shown: string;
  waiting: boolean;
  done: boolean;
  skipped: boolean;
  failed: boolean;
  leaked: number | null;
}

declare global {
  interface Window {
    __otiyotIntro?: IntroProbe;
  }
}

export function introScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const lang = t.lang;
  const settings = ctx.profile.settings;
  const probe: IntroProbe = {
    ready: false,
    beat: '',
    shown: '',
    waiting: false,
    done: false,
    skipped: false,
    failed: false,
    leaked: null,
  };
  window.__otiyotIntro = probe;
  const voice = new StoryVoice(settings.storyVoices, settings.voiceVolume);

  const view = h('div', { class: 'cutscene__view' });
  const box = dialogueBox({
    speaker: '',
    text: '',
    nextHint: t.t('common.continue'),
    nextKey: 'Enter',
    onNext: () => advance(),
  });
  box.el.classList.add('cutscene__dialogue');
  box.el.hidden = true;
  const skip = button({
    label: t.t('intro.skip'),
    variant: 'quiet',
    small: true,
    onClick: () => finish(true),
  });
  skip.dataset.action = 'skip';
  skip.append(keycap('Esc', 'plain', 'sm'));
  const card = h(
    'div',
    { class: 'cutscene__card', hidden: true, role: 'status' },
    h('p', { class: 'cutscene__card-title', text: ACT_ONE[lang] }),
  );
  const loading = h('p', { class: 'cutscene__loading', text: t.t('intro.loading') });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const el = h(
    'section',
    { class: 'cutscene', 'data-testid': 'intro', 'aria-label': t.t('intro.label') },
    view,
    h('div', { class: 'cutscene__bar cutscene__bar--top' }),
    h('div', { class: 'cutscene__bar cutscene__bar--bottom' }),
    loading,
    card,
    h('div', { class: 'cutscene__skip' }, skip),
    box.el,
    live,
  );

  let scene: IntroScene | null = null;
  let stage: Stage3d | null = null;
  let disposed = false;
  let ended = false;
  let raf = 0;
  let handover = 0;
  let lastNow = 0;

  const player = new CutscenePlayer(INTRO, {
    lang,
    speed: settings.textSpeed,
    listener: {
      beat: (b) => onBeat(b),
      end: (skipped) => finish(skipped),
    },
  });

  function onBeat(b: Beat): void {
    probe.beat = b.id;
    scene?.onBeat(b);
    if (b.cue === 'act-title') {
      card.hidden = false;
      el.dataset.card = 'true';
    }
    if (b.say) {
      const who = CAST[b.say.who];
      const line = b.say.text[lang];
      box.setLine(who.name[lang], line, undefined, who.portrait);
      box.reveal(0);
      box.setWaiting(false);
      box.el.hidden = false;
      live.textContent = `${who.name[lang]}: ${line}`;
      voice.say(b.say.who, line, lang);
    } else {
      box.el.hidden = true;
      voice.stop();
    }
  }

  /** Draws the line as it types itself out (every animation frame). */
  const tick = (now: number): void => {
    // Without 3D nobody else moves time along: do it here.
    if (!scene) {
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
      player.update(dt);
    }
    lastNow = now;
    if (player.line) {
      box.reveal(player.shown);
      box.setWaiting(player.waiting);
    }
    probe.shown = player.shownText;
    probe.waiting = player.waiting;
    if (!ended) raf = requestAnimationFrame(tick);
  };

  function advance(): void {
    if (!probe.ready || ended) return;
    if (player.advance() === 'next') ctx.audio.play('ui-move');
  }

  function finish(skipped: boolean): void {
    if (ended) return;
    ended = true;
    if (!player.done) player.skip();
    probe.done = true;
    probe.skipped = skipped;
    voice.stop();
    cancelAnimationFrame(raf);
    // The story remembers that the apprentice has his quill.
    ctx.saves.update((p) => {
      p.story.flags.intro = true;
    });
    void ctx.saves.flush();
    if (skipped) ctx.audio.play('ui-back');
    box.el.hidden = true;
    handover = window.setTimeout(() => ctx.go(HUB), skipped ? 0 : HANDOVER_MS);
  }

  const begin = (): void => {
    if (disposed) return;
    loading.hidden = true;
    probe.ready = true;
    el.dataset.playing = 'true';
    player.start();
    raf = requestAnimationFrame(tick);
  };

  const boot = async (): Promise<void> => {
    const [{ IntroScene }, { mountScene }] = await Promise.all([
      import('../../scenes/intro'),
      import('../stage3d'),
    ]);
    if (disposed) return;
    const s = new IntroScene(apprenticeLook(ctx.profile.avatar));
    s.direct(player);
    scene = s;
    try {
      stage = await mountScene(ctx, view, s, 1948);
    } catch {
      // No 3D here: the story is told in words over the parchment.
      scene = null;
      probe.failed = true;
      el.dataset.flat = 'true';
      ctx.audio.music('hub');
      ctx.audio.intensity(0.3);
      begin();
      return;
    }
    if (disposed) {
      stage.dispose();
      return;
    }
    begin();
  };
  void boot();

  return {
    el,
    full: true,
    ownsMusic: true,
    onKey(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      if (ev.key === 'Enter' || ev.key === ' ') {
        advance();
        return true;
      }
      return false;
    },
    onEscape() {
      if (probe.ready) finish(true);
      return true;
    },
    focus() {
      el.focus?.();
    },
    dispose() {
      disposed = true;
      ended = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(handover);
      voice.stop();
      probe.leaked = stage ? stage.dispose() : 0;
      stage = null;
      scene = null;
    },
  };
}
