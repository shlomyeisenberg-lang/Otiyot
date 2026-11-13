// The Blank Scroll (#/scroll, opened from the hub's map once the Arena is restored): the final
// sequence (T27). It is one long fight in the boss kit's terms, so it runs on the arena's boss
// screen with its own stage (the ScrollScene), its own nine phases, the allies' calls, the
// ending and the typed credits. Finishing it sets the New Game+ flag.

import { recordRegionRank, regionMode } from '../../game/regions';
import {
  allyAt,
  BLANK_SCROLL,
  isKeeperPhase,
  planCredits,
  planScroll,
} from '../../scenes/scroll/plan';
import {
  CAST,
  SCROLL_ENDING,
  SCROLL_LINES,
  SCROLL_NAMES,
  SCROLL_PHASE_LINES,
  scrollLine,
  THE_END,
  type ScrollMoment,
  type ScrollPhase,
} from '../../story';
import type { AppContext, Screen } from '../app';
import type { MessageKey } from '../i18n';
import { bossScreen, type BossConfig } from './arena';

/** The story flag a finished game sets (New Game+). */
export const NEW_GAME_PLUS = 'ngplus';

/** How many credit lines there are (locales: scroll.credits.1 ..). */
export const CREDIT_LINES = 7;

export function scrollConfig(ctx: AppContext): BossConfig {
  const t = ctx.i18n;
  const lang = ctx.profile.settings.uiLanguage;
  const pid = (i: number): ScrollPhase => (BLANK_SCROLL.phases[i]?.id ?? 'c1') as ScrollPhase;
  const moment = (m: string): ScrollMoment => (m in SCROLL_LINES ? (m as ScrollMoment) : 'parry');
  return {
    key: BLANK_SCROLL.id,
    look: 'scroll',
    stage: () => import('../../scenes/scroll').then((m) => (look) => new m.ScrollScene({ look })),
    def: BLANK_SCROLL,
    plan: planScroll,
    region: 'scroll',
    mode: (level, difficulty) => regionMode('scroll', level, difficulty),
    modePrefix: `scene:${BLANK_SCROLL.id}:`,
    testid: 'scroll',
    loading: t.t('scroll.loading'),
    name: SCROLL_NAMES.scroll[lang],
    nameAt: (i) => SCROLL_NAMES[isKeeperPhase(i) ? 'keeper' : 'scroll'][lang],
    phaseName: (i) => t.t(`scroll.phase.${pid(i)}` as MessageKey),
    phaseHow: (i) => t.t(`scroll.phase.how.${pid(i)}` as MessageKey),
    phaseLine: (i) => SCROLL_PHASE_LINES[pid(i)],
    line: (m, n) => scrollLine(moment(m), n),
    weakLine: (plan, phase, word) => {
      const who = allyAt(plan, phase, word);
      return who ? scrollLine('stagger', who === 'naftali' ? 0 : 1) : null;
    },
    call: (plan, phase, word) => {
      const who = allyAt(plan, phase, word);
      return who ? t.t('scroll.call', { name: CAST[who].name[lang] }) : null;
    },
    healMoment: 'slip',
    victory: SCROLL_ENDING,
    card: () => ({ kicker: t.t('scroll.victory'), title: THE_END[lang] }),
    credits: {
      plan: planCredits,
      lines: () =>
        Array.from({ length: CREDIT_LINES }, (_, i) =>
          t.t(`scroll.credits.${i + 1}` as MessageKey, { name: ctx.profile.name }),
        ),
      title: t.t('scroll.credits.title'),
      hint: t.t('scroll.credits.hint'),
    },
    beaten: (p) => (p.story.ranks.scroll ?? 0) > 0,
    win: (p, rank) => {
      const first = (p.story.ranks.scroll ?? 0) === 0;
      recordRegionRank(p, 'scroll', rank);
      p.story.flags[NEW_GAME_PLUS] = true;
      return first ? t.t('scroll.results.written') : null;
    },
    home: {
      route: 'hub',
      label: t.t('arena.results.home'),
      labelEnter: t.t('arena.results.homeEnter'),
    },
  };
}

export function scrollScreen(ctx: AppContext): Screen {
  return bossScreen(ctx, scrollConfig(ctx));
}
