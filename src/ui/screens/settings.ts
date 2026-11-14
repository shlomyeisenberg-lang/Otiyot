// Settings: display, accessibility, graphics, sound, typing, health and keys. Every control calls
// updateSettings, which saves and re-applies theme, language and sound at once; scenes read the
// rest (shake, flash, quality) when they start.

import type { BackspacePolicy, NiqqudMode } from '../../core';
import { QUALITY_NAMES, type QualityChoice } from '../../engine/quality';
import { DIFFICULTY_IDS, type DifficultyId } from '../../game/difficulty';
import {
  BREAK_CHOICES,
  MENU_KEYS,
  type KeyboardGuideMode,
  type Settings,
  type TextSpeed,
  type ThemeChoice,
} from '../../save';
import { TEXT_SPEEDS } from '../../story';
import type { AppContext, Screen } from '../app';
import { button, field, select, slider, tabs, toggle } from '../components';
import { h } from '../dom';
import { LANGS, type Lang, type MessageKey } from '../i18n';
import { frame } from './frame';

type BoolSetting = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

let lastTab = 'display';

export function settingsScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const cur = (): Settings => ctx.profile.settings;

  const switchRow = (key: BoolSetting, label: MessageKey, hint: MessageKey): HTMLElement => {
    const tg = toggle({
      checked: cur()[key],
      onText: t.t('common.on'),
      offText: t.t('common.off'),
      onChange: (v) => ctx.updateSettings({ [key]: v }),
    });
    tg.el.dataset.setting = key;
    return field({ label: t.t(label), hint: t.t(hint) }, tg.el, tg.state);
  };

  const volumeRow = (
    key: 'musicVolume' | 'sfxVolume' | 'voiceVolume' | 'uiVolume',
    label: MessageKey,
  ): HTMLElement => {
    const sl = slider({
      min: 0,
      max: 100,
      step: 5,
      value: Math.round(cur()[key] * 100),
      format: (v) => `${v}%`,
      onChange: (v) => ctx.updateSettings({ [key]: v / 100 }),
    });
    return field({ label: t.t(label) }, sl.el, sl.value);
  };

  const display = (): HTMLElement => {
    const language = select<Lang>(
      LANGS.map((l) => ({ value: l, label: t.t(`lang.${l}`) })),
      cur().uiLanguage,
      (v) => ctx.setLanguage(v),
    );
    const themes: ThemeChoice[] = ['auto', 'light', 'dark'];
    const theme = select<ThemeChoice>(
      themes.map((v) => ({ value: v, label: t.t(`theme.${v}`) })),
      cur().theme,
      (v) => ctx.updateSettings({ theme: v }),
    );
    theme.dataset.setting = 'theme';
    const speed = select<TextSpeed>(
      TEXT_SPEEDS.map((v) => ({ value: v, label: t.t(`settings.textSpeed.${v}`) })),
      cur().textSpeed,
      (v) => ctx.updateSettings({ textSpeed: v }),
    );
    speed.dataset.setting = 'textSpeed';
    return h(
      'div',
      {},
      field({ label: t.t('settings.language'), hint: t.t('settings.languageHint') }, language),
      field({ label: t.t('settings.theme') }, theme),
      field({ label: t.t('settings.textSpeed'), hint: t.t('settings.textSpeedHint') }, speed),
    );
  };

  const percentRow = (key: 'shake' | 'flash', label: MessageKey, hint: MessageKey): HTMLElement => {
    const sl = slider({
      min: 0,
      max: 100,
      step: 10,
      value: Math.round(cur()[key] * 100),
      format: (v) => `${v}%`,
      onChange: (v) => ctx.updateSettings({ [key]: v / 100 }),
    });
    sl.el.dataset.setting = key;
    return field({ label: t.t(label), hint: t.t(hint) }, sl.el, sl.value);
  };

  const access = (): HTMLElement =>
    h(
      'div',
      {},
      switchRow('colorblind', 'settings.colorblind', 'settings.colorblindHint'),
      switchRow('highContrast', 'settings.highContrast', 'settings.highContrastHint'),
      switchRow('largeText', 'settings.largeText', 'settings.largeTextHint'),
      switchRow('dyslexiaFont', 'settings.dyslexia', 'settings.dyslexiaHint'),
      switchRow('reducedMotion', 'settings.reducedMotion', 'settings.reducedMotionHint'),
      percentRow('shake', 'settings.shake', 'settings.shakeHint'),
      percentRow('flash', 'settings.flash', 'settings.flashHint'),
      switchRow('captions', 'settings.captions', 'settings.captionsHint'),
    );

  const graphics = (): HTMLElement => {
    const choices: QualityChoice[] = ['auto', ...QUALITY_NAMES];
    const quality = select<QualityChoice>(
      choices.map((v) => ({ value: v, label: t.t(`settings.quality.${v}`) })),
      cur().quality,
      (v) => ctx.updateSettings({ quality: v }),
    );
    quality.dataset.setting = 'quality';
    return h(
      'div',
      {},
      field({ label: t.t('settings.quality'), hint: t.t('settings.qualityHint') }, quality),
      h(
        'div',
        { class: 'page__actions' },
        button({ label: t.t('settings.rangeButton'), onClick: () => ctx.go('range') }),
      ),
    );
  };

  const health = (): HTMLElement => {
    const breaks = select<string>(
      BREAK_CHOICES.map((m) => ({ value: String(m), label: t.t(`settings.break.${m}`) })),
      String(cur().breakMinutes),
      (v) => ctx.updateSettings({ breakMinutes: Number(v) }),
    );
    breaks.dataset.setting = 'breakMinutes';
    return h(
      'div',
      {},
      field({ label: t.t('settings.break'), hint: t.t('settings.breakHint') }, breaks),
      switchRow('postureTips', 'settings.posture', 'settings.postureHint'),
    );
  };

  const keys = (): HTMLElement => {
    const menuKey = select<string>(
      MENU_KEYS.map((k) => ({ value: k, label: t.t(`settings.menuKey.${k}`) })),
      cur().menuKey,
      (v) => ctx.updateSettings({ menuKey: v }),
    );
    menuKey.dataset.setting = 'menuKey';
    return h(
      'div',
      {},
      field({ label: t.t('settings.menuKey'), hint: t.t('settings.menuKeyHint') }, menuKey),
    );
  };

  const sound = (): HTMLElement =>
    h(
      'div',
      {},
      volumeRow('musicVolume', 'settings.music'),
      volumeRow('sfxVolume', 'settings.sfx'),
      volumeRow('voiceVolume', 'settings.voice'),
      volumeRow('uiVolume', 'settings.ui'),
      switchRow('storyVoices', 'settings.storyVoices', 'settings.storyVoicesHint'),
      h(
        'div',
        { class: 'page__actions' },
        button({
          label: t.t('settings.soundRoom'),
          icon: 'sound',
          onClick: () => ctx.go('sound'),
        }),
      ),
      h('p', { class: 'page__note', text: t.t('settings.soundRoomHint') }),
    );

  const typing = (): HTMLElement => {
    const policies: BackspacePolicy[] = ['allowed', 'disabled', 'mustFix'];
    const backspace = select<BackspacePolicy>(
      policies.map((v) => ({ value: v, label: t.t(`settings.backspace.${v}`) })),
      cur().backspace,
      (v) => ctx.updateSettings({ backspace: v }),
    );
    const modes: NiqqudMode[] = ['ignore', 'required'];
    const niqqud = select<NiqqudMode>(
      modes.map((v) => ({ value: v, label: t.t(`settings.niqqud.${v}`) })),
      cur().niqqud,
      (v) => ctx.updateSettings({ niqqud: v }),
    );
    const guides: KeyboardGuideMode[] = ['keys', 'hands', 'off'];
    const guide = select<KeyboardGuideMode>(
      guides.map((v) => ({ value: v, label: t.t(`guide.mode.${v}`) })),
      cur().keyboardGuide,
      (v) => ctx.updateSettings({ keyboardGuide: v }),
    );
    guide.dataset.setting = 'keyboardGuide';
    const difficulty = select<DifficultyId>(
      DIFFICULTY_IDS.map((v) => ({ value: v, label: t.t(`range.difficulty.${v}`) })),
      cur().difficulty,
      (v) => ctx.updateSettings({ difficulty: v }),
    );
    difficulty.dataset.setting = 'difficulty';
    return h(
      'div',
      {},
      field(
        { label: t.t('settings.keyboardGuide'), hint: t.t('settings.keyboardGuideHint') },
        guide,
      ),
      field({ label: t.t('settings.backspace'), hint: t.t('settings.backspaceHint') }, backspace),
      field({ label: t.t('settings.niqqud'), hint: t.t('settings.niqqudHint') }, niqqud),
      field(
        { label: t.t('settings.difficulty'), hint: t.t('settings.difficultyHint') },
        difficulty,
      ),
      switchRow('hardcore', 'settings.hardcore', 'settings.hardcoreHint'),
      h(
        'div',
        { class: 'page__actions' },
        button({ label: t.t('settings.trackButton'), onClick: () => ctx.go('track') }),
        button({ label: t.t('settings.layoutButton'), onClick: () => ctx.go('layout') }),
      ),
    );
  };

  const tb = tabs(
    [
      { id: 'display', label: t.t('settings.display'), content: display },
      { id: 'access', label: t.t('settings.tabs.access'), content: access },
      { id: 'graphics', label: t.t('settings.tabs.graphics'), content: graphics },
      { id: 'sound', label: t.t('settings.sound'), content: sound },
      { id: 'typing', label: t.t('settings.typing'), content: typing },
      { id: 'health', label: t.t('settings.tabs.health'), content: health },
      { id: 'keys', label: t.t('settings.tabs.keys'), content: keys },
    ],
    t.t('settings.tabs'),
    lastTab,
  );
  tb.el.addEventListener('click', (ev) => {
    const id = (ev.target as HTMLElement).closest<HTMLElement>('[data-tab]')?.dataset.tab;
    if (id) lastTab = id;
  });

  const el = frame({ title: t.t('settings.title') }, tb.el);
  return {
    el,
    focus: () =>
      el
        .querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
        ?.focus({ preventScroll: true }),
  };
}
