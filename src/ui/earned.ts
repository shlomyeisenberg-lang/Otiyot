// What a run earned, for every results card (T33): XP, glyphs and ink (with what the abilities
// added), the level bar, a new level with its skill point and gifts, and a hidden letter found.

import type { RunRewards } from '../game/results';
import { levelOf, shopItem, type RunGain } from '../game/progression';
import type { Profile } from '../save';
import { progressBar, statTile, status } from './components';
import { h } from './dom';
import type { I18n, MessageKey } from './i18n';

/** The name of a shop item in the player's language. */
export function itemName(t: I18n, id: string): string {
  return t.t(`shop.item.${id.replace(':', '.')}` as MessageKey);
}

const plus = (n: number): string => `+${n}`;

export function earnedRow(
  t: I18n,
  r: Pick<RunRewards, 'xp' | 'glyphs' | 'ink'>,
  gain: RunGain | null,
): HTMLElement {
  const xp = gain?.xp ?? r.xp;
  const glyphs = gain?.glyphs ?? r.glyphs;
  const ink = gain?.ink ?? r.ink;
  const tiles = h(
    'div',
    { class: 'range__results-earned' },
    statTile({ label: t.t('range.results.xp'), value: plus(xp), gold: true }),
    statTile({ label: t.t('range.results.glyphs'), value: plus(glyphs), gold: true }),
    statTile({ label: t.t('range.results.ink'), value: plus(ink), gold: true }),
  );
  const box = h('div', { class: 'earned', 'data-testid': 'earned' }, tiles);
  if (!gain) return box;
  const b = gain.bonus;
  if (b.xp > 0 || b.glyphs > 0 || b.ink > 0) {
    box.append(
      h('p', {
        class: 'earned__bonus',
        text: t.t('earned.bonus', { xp: b.xp, glyphs: b.glyphs, ink: b.ink }),
      }),
    );
  }
  if (gain.letter) {
    box.append(
      h(
        'div',
        { class: 'earned__letter', 'data-letter': gain.letter, role: 'status' },
        h('span', { class: 'earned__glyph', 'aria-hidden': 'true', text: gain.letter }),
        h(
          'span',
          { class: 'earned__letter-text' },
          h('strong', { text: t.t('earned.letter') }),
          h('span', { text: t.t('earned.letterHint') }),
        ),
      ),
    );
  }
  if (gain.level > gain.levelBefore) {
    const items = [...gain.gifts.map((id) => t.t('earned.gift', { item: itemName(t, id) }))];
    if (gain.shelf.length > 0) items.push(t.t('earned.shelf', { n: gain.shelf.length }));
    box.append(
      h(
        'div',
        { class: 'earned__level', 'data-level': gain.level },
        status(t.t('earned.levelUp', { level: gain.level }), 'gold'),
        h('p', {
          class: 'earned__note',
          text: [t.t('earned.point', { n: gain.points }), ...items].join(' · '),
        }),
      ),
    );
  }
  return box;
}

/** The player's level and the bar to the next one (shop header, results). */
export function levelBar(t: I18n, profile: Profile): HTMLElement {
  const info = levelOf(profile.progress.xp);
  const label =
    info.need > 0
      ? t.t('shop.levelOf', { level: info.level, into: info.into, need: info.need })
      : t.t('shop.levelMax', { level: info.level });
  const bar = progressBar(label, Math.round(info.share * 100), 100);
  return h(
    'div',
    { class: 'level-bar', 'data-level': info.level },
    h('span', {
      class: 'level-bar__badge',
      text: String(info.level),
      'aria-label': t.t('shop.levelBar', { level: info.level }),
    }),
    h('div', { class: 'level-bar__body' }, bar.el),
  );
}

/** True when the item id is known (guards locale lookups in tests). */
export function knownItem(id: string): boolean {
  return shopItem(id) !== undefined;
}
