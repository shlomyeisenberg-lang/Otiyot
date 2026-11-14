// A story chapter (T35): the short scene before a region opens for the first time, or after it is
// first restored. It plays over the parchment with the dialogue box (portrait, speaker, the line
// typing itself out at the player's text speed, optional voice). Captions are always on screen and
// read out to screen readers. Enter or Space continues; Esc skips. When it ends (or is skipped)
// the story remembers it and goes on to where it was heading: the region's scene or the hub.

import { REGIONS } from '../../game/regions';
import { actCard, CAST, chapterById, chapterFlag, CutscenePlayer, type Beat } from '../../story';
import { HUB, type AppContext, type Route, type Screen } from '../app';
import { takeWantedChapter } from '../chapterQueue';
import { button, dialogueBox, keycap } from '../components';
import { h } from '../dom';
import { StoryVoice } from '../voice';

/** How long a title card stays before the first line. */
const CARD_MS = 1400;

interface ChapterProbe {
  id: string;
  beat: string;
  shown: string;
  waiting: boolean;
  done: boolean;
  skipped: boolean;
}

declare global {
  interface Window {
    __otiyotChapter?: ChapterProbe;
  }
}

export function chapterScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const lang = t.lang;
  const settings = ctx.profile.settings;
  const want = takeWantedChapter();
  const chapter = want ? chapterById(want.id) : null;
  const next: Route = want?.next ?? HUB;
  const probe: ChapterProbe = {
    id: chapter?.id ?? '',
    beat: '',
    shown: '',
    waiting: false,
    done: false,
    skipped: false,
  };
  window.__otiyotChapter = probe;
  const voice = new StoryVoice(settings.storyVoices, settings.voiceVolume);

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
  const actTitle = h('p', { class: 'cutscene__card-title' });
  const placeTitle = h('p', { class: 'cutscene__card-title' });
  const card = h(
    'div',
    { class: 'cutscene__card', hidden: true, role: 'status' },
    actTitle,
    placeTitle,
  );
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const el = h(
    'section',
    {
      class: 'cutscene',
      'data-testid': 'chapter',
      'data-flat': 'true',
      'data-playing': 'true',
      'aria-label': t.t('chapter.label'),
    },
    h('div', { class: 'cutscene__view' }),
    card,
    h('div', { class: 'cutscene__skip' }, skip),
    box.el,
    live,
  );

  let ended = false;
  let raf = 0;
  let lastNow = 0;
  let cardTimer = 0;
  let handover = 0;

  const player = new CutscenePlayer(
    chapter?.scene ?? { id: 'none', title: { he: '', en: '' }, beats: [] },
    {
      lang,
      speed: settings.textSpeed,
      listener: { beat: (b) => onBeat(b), end: (skipped) => finish(skipped) },
    },
  );

  function onBeat(b: Beat): void {
    probe.beat = b.id;
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

  const tick = (now: number): void => {
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
    lastNow = now;
    if (!card.hidden) {
      // The cards hold the clock still; the lines start when they are gone.
    } else if (!ended) {
      player.update(dt);
    }
    if (player.line) {
      box.reveal(player.shown);
      box.setWaiting(player.waiting);
    }
    probe.shown = player.shownText;
    probe.waiting = player.waiting;
    if (!ended) raf = requestAnimationFrame(tick);
  };

  function advance(): void {
    if (ended || !card.hidden) return;
    if (player.advance() === 'next') ctx.audio.play('ui-move');
  }

  function finish(skipped: boolean): void {
    if (ended) return;
    ended = true;
    window.clearTimeout(cardTimer);
    if (!player.done) player.skip();
    probe.done = true;
    probe.skipped = skipped;
    voice.stop();
    cancelAnimationFrame(raf);
    if (chapter) {
      const region = REGIONS.find((r) => r.id === chapter.region);
      ctx.saves.update((p) => {
        p.story.flags[chapterFlag(chapter.id)] = true;
        if (chapter.kind === 'start' && region && region.act >= 2) {
          p.story.flags[`ch:act-${region.act}`] = true;
        }
      });
      void ctx.saves.flush();
    }
    if (skipped) ctx.audio.play('ui-back');
    box.el.hidden = true;
    handover = window.setTimeout(() => ctx.go(next), skipped ? 0 : 250);
  }

  if (!chapter) {
    // Nothing was asked for (a stray visit): go straight on.
    window.setTimeout(() => finish(true), 0);
  } else {
    const region = REGIONS.find((r) => r.id === chapter.region);
    const showAct =
      chapter.kind === 'start' &&
      region &&
      ctx.profile.story.flags[`ch:act-${region.act}`] !== true;
    const act = showAct && region ? actCard(region.act) : null;
    actTitle.textContent = act ? act[lang] : '';
    actTitle.hidden = !act;
    placeTitle.textContent = chapter.scene.title[lang];
    card.hidden = false;
    live.textContent = `${act ? `${act[lang]}. ` : ''}${chapter.scene.title[lang]}`;
    ctx.audio.music('hub');
    ctx.audio.intensity(0.3);
    cardTimer = window.setTimeout(
      () => {
        card.hidden = true;
        player.start();
      },
      act ? CARD_MS * 1.6 : CARD_MS,
    );
    raf = requestAnimationFrame(tick);
  }

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
      finish(true);
      return true;
    },
    focus() {
      el.focus?.();
    },
    dispose() {
      ended = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(cardTimer);
      window.clearTimeout(handover);
      voice.stop();
    },
  };
}
