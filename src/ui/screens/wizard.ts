// New player in three steps: name, keyboard, lesson track. Also the first-run welcome, where the
// steps fill in the player that every fresh save starts with instead of adding a second one.

import type { LayoutId } from '../../core';
import { MAX_NAME, type Track } from '../../save';
import type { AppContext, Screen } from '../app';
import { button } from '../components';
import { h } from '../dom';
import { frame, keysHint } from './frame';
import { layoutPicker, trackPicker, type Picker } from './pickers';

const STEPS = 3;

export function wizardScreen(
  ctx: AppContext,
  mode: 'welcome' | 'new',
  onDone?: () => void,
): Screen {
  const t = ctx.i18n;
  const host = h('div', { class: 'wizard' });
  const state: { step: number; name: string; layout: LayoutId; track: Track } = {
    step: 1,
    name: '',
    layout: t.lang,
    track: 1,
  };
  let picker: Picker<LayoutId> | Picker<Track> | null = null;
  let focusStep: () => void = () => undefined;
  const title = t.t(mode === 'welcome' ? 'wizard.welcomeTitle' : 'wizard.newTitle');

  const finish = (): void => {
    const name = state.name.trim() || t.t('wizard.namePlaceholder');
    if (mode === 'welcome') ctx.saves.renameProfile(ctx.profile.id, name);
    else {
      const lang = t.lang;
      ctx.saves.createProfile(name);
      ctx.saves.update((p) => {
        p.settings.uiLanguage = lang;
      });
    }
    ctx.saves.update((p) => {
      p.layout = state.layout;
      p.track = state.track;
    });
    void ctx.saves.flush();
    onDone?.();
    // A brand-new apprentice goes straight into the story's opening; others to the menu.
    const story = mode === 'welcome' && !ctx.profile.story.flags.intro;
    if (!story) ctx.toast.show(t.t('wizard.created', { name: ctx.profile.name }), 'gold', 4200);
    ctx.go(story ? 'intro' : 'menu');
  };

  const next = (): void => {
    if (state.step >= STEPS) finish();
    else {
      state.step += 1;
      draw();
      focusStep();
    }
  };
  const prev = (): void => {
    if (state.step > 1) {
      state.step -= 1;
      draw();
      focusStep();
    } else if (mode === 'new') ctx.back();
  };

  const dots = (): HTMLElement => {
    const el = h('div', { class: 'steps', 'aria-hidden': 'true' });
    for (let i = 1; i <= STEPS; i += 1) {
      el.append(
        h('span', {
          class:
            i === state.step
              ? 'steps__dot steps__dot--on'
              : i < state.step
                ? 'steps__dot steps__dot--done'
                : 'steps__dot',
        }),
      );
    }
    return el;
  };

  const actions = (): HTMLElement => {
    const row = h('div', { class: 'wizard__actions' });
    if (state.step > 1 || mode === 'new') {
      row.append(
        button({
          label: t.t('common.back'),
          variant: 'quiet',
          icon: 'back',
          flipIcon: true,
          onClick: prev,
        }),
      );
    }
    const go = button({
      label: t.t(state.step === STEPS ? 'wizard.begin' : 'common.continue'),
      variant: 'primary',
      icon: state.step === STEPS ? 'quill' : undefined,
      onClick: next,
    });
    go.dataset.action = 'next';
    row.append(go);
    return row;
  };

  function draw(): void {
    const kicker = t.t('common.step', { n: state.step, total: STEPS });
    picker = null;
    let body: HTMLElement;
    let head: { title: string; lead?: string };
    if (state.step === 1) {
      const input = h('input', {
        class: 'input input--name',
        type: 'text',
        id: 'player-name',
        maxlength: MAX_NAME,
        autocomplete: 'off',
        spellcheck: 'false',
        dir: 'auto',
        placeholder: t.t('wizard.namePlaceholder'),
        'aria-describedby': 'player-name-hint',
      });
      input.value = state.name;
      input.addEventListener('input', () => {
        state.name = input.value;
      });
      body = h(
        'div',
        { class: 'wizard__name' },
        h('label', { class: 'sr-only', for: 'player-name', text: t.t('wizard.nameLabel') }),
        input,
        h('p', { class: 'page__note', id: 'player-name-hint', text: t.t('wizard.nameHint') }),
      );
      head = { title: t.t('wizard.nameQuestion') };
      focusStep = () => input.focus({ preventScroll: true });
    } else if (state.step === 2) {
      const p = layoutPicker(t, state.layout, (layout) => {
        state.layout = layout;
      });
      picker = p;
      body = p.el;
      head = { title: t.t('layout.title'), lead: t.t('layout.lead') };
      focusStep = p.focus;
    } else {
      const p = trackPicker(t, state.layout, state.track, (track) => {
        state.track = track;
      });
      picker = p;
      body = h('div', {}, p.el, h('p', { class: 'page__note', text: t.t('track.note') }));
      head = { title: t.t('track.title'), lead: t.t('track.lead') };
      focusStep = p.focus;
    }
    const mark =
      mode === 'welcome'
        ? h(
            'p',
            {
              class: 'title__mark title__mark--small',
              lang: 'he',
              dir: 'rtl',
              'aria-hidden': 'true',
            },
            'אותיות',
          )
        : null;
    host.replaceChildren(
      mark ?? '',
      frame(
        { kicker: `${title} · ${kicker}`, ...head },
        dots(),
        body,
        actions(),
        state.step > 1 ? keysHint(t.t('common.keysHint')) : null,
      ),
    );
    host.classList.toggle('wizard--wide', state.step > 1);
  }

  draw();

  return {
    el: host,
    wide: true,
    focus: () => focusStep(),
    onKey(ev) {
      if (ev.key === 'Enter') {
        // Enter on a button already presses it; anywhere else it means "continue".
        const target = ev.target as HTMLElement | null;
        if (target?.closest('button') && !target.closest('[role="radio"]')) return false;
        next();
        return true;
      }
      return picker?.onKey(ev) ?? false;
    },
  };
}
