// The Silent Arena's trials (T26): the board (#/trials, opened from the hub's map once the Arena
// region opens) with the three bosses that wait in the arena, each with its skill and its rank;
// and the fight itself (#/trial), which is the same boss screen as the Great Blot's with the
// trial's own config. Once all three are beaten, the Arena is restored (its rank is the lowest
// of the three) and the board says the way to the Blank Scroll is open.

import { regionMode } from '../../game/regions';
import { rankFromNumber } from '../../game/regions';
import {
  nextTrial,
  recordTrialRank,
  trialKey,
  trialRank,
  TRIAL_IDS,
  TRIALS_REGION,
  type TrialId,
} from '../../game/trials';
import { planTrial, TRIAL_SKILL, TRIALS } from '../../scenes/arena/trials';
import { arenaLine, TRIAL_NAMES, TRIAL_VICTORY, ARENA_WHOLE, trialLine } from '../../story';
import type { AppContext, Screen } from '../app';
import { button, keycap, rankBadge, status } from '../components';
import { h } from '../dom';
import type { MessageKey } from '../i18n';
import { bossScreen, type BossConfig } from './arena';
import { frame, keysHint } from './frame';

let picked: TrialId | null = null;

/** The trial the next #/trial opens (the board sets it). */
export function pickTrial(id: TrialId | null): void {
  picked = id;
}

/** One trial as a boss config for the arena's boss screen. */
export function trialConfig(ctx: AppContext, id: TrialId): BossConfig {
  const t = ctx.i18n;
  const lang = ctx.profile.settings.uiLanguage;
  const def = TRIALS[id];
  const pid = (i: number): string => def.phases[i]?.id ?? 'p1';
  const name = TRIAL_NAMES[id][lang];
  return {
    key: def.id,
    look: id,
    def,
    plan: (o) => planTrial(id, o),
    region: TRIALS_REGION,
    mode: (level, difficulty) => `${regionMode(TRIALS_REGION, level, difficulty)}:${id}`,
    modePrefix: `scene:${TRIALS_REGION}:`,
    testid: 'trial',
    name,
    phaseName: (i) => t.t(`trials.${id}.${pid(i)}` as MessageKey),
    phaseHow: (i) => t.t(`trials.${id}.how.${pid(i)}` as MessageKey),
    line: (m, n) => trialLine(id, m, (shared) => arenaLine(shared, n)),
    victory: TRIAL_VICTORY[id],
    card: () => {
      const whole = (ctx.profile.story.ranks[TRIALS_REGION] ?? 0) > 0;
      return {
        kicker: t.t('trials.undone', { name }),
        title: whole ? ARENA_WHOLE[lang] : t.t(`trials.skill.${TRIAL_SKILL[id]}` as MessageKey),
      };
    },
    beaten: (p) => (p.story.ranks[trialKey(id)] ?? 0) > 0,
    win: (p, rank) => {
      const first = (p.story.ranks[trialKey(id)] ?? 0) === 0;
      const whole = recordTrialRank(p, id, rank);
      if (whole) return t.t('trials.results.whole');
      return first ? t.t('trials.results.beaten', { name }) : null;
    },
    home: {
      route: 'trials',
      label: t.t('trials.results.board'),
      labelEnter: t.t('trials.results.boardEnter'),
    },
  };
}

/** #/trial: the fight with the picked trial (or the first one not beaten yet). */
export function trialScreen(ctx: AppContext): Screen {
  const id = picked ?? nextTrial(ctx.profile) ?? 'storm';
  return bossScreen(ctx, trialConfig(ctx, id));
}

/** #/trials: the board of the three trials. */
export function trialsScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const p = ctx.profile;
  const lang = p.settings.uiLanguage;
  const next = nextTrial(p);
  const open = (id: TrialId): void => {
    pickTrial(id);
    ctx.go('trial');
  };

  const cards = TRIAL_IDS.map((id, i) => {
    const rank = trialRank(p, id);
    const skill = TRIAL_SKILL[id];
    const fight = button({
      label: t.t(rank ? 'trials.again' : 'trials.fight'),
      variant: id === next ? 'primary' : 'quiet',
      small: true,
      onClick: () => open(id),
    });
    fight.dataset.trial = id;
    fight.setAttribute('aria-keyshortcuts', String(i + 1));
    return h(
      'article',
      {
        class: 'trials__card',
        'data-trial': id,
        'data-state': rank ? 'beaten' : id === next ? 'next' : 'waiting',
      },
      h('span', { class: 'trials__sigil', 'data-skill': skill, 'aria-hidden': 'true' }),
      h(
        'header',
        { class: 'trials__head' },
        keycap(String(i + 1), id === next ? 'gold' : undefined),
        h(
          'div',
          {},
          h('p', { class: 'trials__skill', text: t.t(`trials.skill.${skill}` as MessageKey) }),
          h('h2', { class: 'trials__name', text: TRIAL_NAMES[id][lang] }),
        ),
        rank
          ? rankBadge(rank, t.t('rank.label', { rank }))
          : status(t.t('trials.notYet'), 'neutral'),
      ),
      h('p', { class: 'trials__body', text: t.t(`trials.${id}.about` as MessageKey) }),
      h('div', { class: 'trials__actions' }, fight),
    );
  });

  const whole = rankFromNumber(p.story.ranks[TRIALS_REGION]);
  const el = frame(
    {
      kicker: t.t('region.arena'),
      title: t.t('trials.title'),
      lead: t.t('trials.lead'),
    },
    whole
      ? h(
          'div',
          { class: 'trials__whole' },
          rankBadge(whole, t.t('rank.label', { rank: whole })),
          h('p', { text: t.t('trials.whole') }),
        )
      : '',
    h('div', { class: 'trials', 'data-testid': 'trials' }, ...cards),
    h(
      'div',
      { class: 'trials__foot' },
      button({ label: t.t('trials.home'), variant: 'quiet', onClick: () => ctx.go('hub') }),
    ),
    keysHint(t.t('trials.keys')),
  );

  return {
    el,
    wide: true,
    onKey(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      const n = Number(ev.key);
      const id = TRIAL_IDS[n - 1];
      if (Number.isInteger(n) && id) {
        open(id);
        return true;
      }
      if (ev.key === 'Enter' && document.activeElement === document.body) {
        open(next ?? 'storm');
        return true;
      }
      return false;
    },
    focus() {
      const first = el.querySelector<HTMLButtonElement>(`[data-trial="${next ?? 'storm'}"] button`);
      first?.focus();
    },
  };
}
