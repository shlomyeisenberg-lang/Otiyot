// The Ink Shop (T33, #/shop, the hub's shop shelf): what the player has earned and what to do
// with it. A header with the level bar, the wallet and the apprentice as he is dressed now (Dyo
// in the inkwell's color beside him); then four tabs: the shelf (robes, quills, inks and things
// for the house), the crafting table, the skill tree (abilities), and the hidden letters.

import {
  ITEMS,
  RECIPES,
  SECRETS,
  SKILLS,
  BRANCHES,
  buyItem,
  craft,
  dressOf,
  dressedLook,
  equipItem,
  itemState,
  learnSkill,
  levelOf,
  recipeState,
  regionStatuses,
  shopItem,
  skillPoints,
  skillState,
  toggleDecor,
  toggleSkill,
  decorShown,
  type AbilityId,
  type ItemSlot,
  type ShopItem,
} from '../../game';
import type { AppContext, Screen } from '../app';
import { button, panel, status, tabs } from '../components';
import { h } from '../dom';
import { itemName, levelBar } from '../earned';
import type { MessageKey } from '../i18n';
import { frame } from './frame';

let lastTab = 'shelf';

const SVG = 'http://www.w3.org/2000/svg';
const hex = (n: number | undefined): string => `#${(n ?? 0).toString(16).padStart(6, '0')}`;
/** Skin tone of the little figure (the same as the 3D apprentice's). */
const SKIN = 0xd9a77e;

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/**
 * The apprentice as a small paper cut-out: robe with its hem, the scarf and cap in the trim
 * color, the quill in his hand in the feather and nib colors, and Dyo the ink drop beside him.
 */
function figure(
  look: ReturnType<typeof dressedLook>,
  dyo: readonly number[],
  label: string,
): SVGElement {
  const root = svg('svg', { viewBox: '0 0 120 140', class: 'shop-figure', role: 'img' });
  root.setAttribute('aria-label', label);
  const defs = svg('defs', {});
  const grad = svg('linearGradient', { id: 'robe-grad', x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(
    svg('stop', { offset: '0.45', 'stop-color': hex(look.robe) }),
    svg('stop', { offset: '1', 'stop-color': hex(look.hem) }),
  );
  defs.append(grad);
  root.append(defs);
  root.append(
    svg('ellipse', { cx: 52, cy: 131, rx: 34, ry: 5, class: 'shop-figure__shadow' }),
    // Robe.
    svg('path', { d: 'M34 128 L40 62 Q52 54 64 62 L70 128 Z', fill: 'url(#robe-grad)' }),
    // Sleeve and hand holding the quill.
    svg('path', { d: 'M62 66 L80 86 L76 90 L58 74 Z', fill: hex(look.robe) }),
    svg('circle', { cx: 80, cy: 88, r: 4.5, fill: hex(SKIN) }),
    // Quill: shaft in the nib's ink, feather on top.
    svg('line', { x1: 78, y1: 96, x2: 92, y2: 62, stroke: hex(look.shaft), 'stroke-width': 2 }),
    svg('path', { d: 'M88 72 Q100 52 96 36 Q86 50 87 70 Z', fill: hex(look.feather) }),
    // Scarf.
    svg('path', { d: 'M40 62 Q52 70 64 62 L62 70 Q52 76 42 70 Z', fill: hex(look.trim) }),
    // Head and cap.
    svg('circle', { cx: 52, cy: 46, r: 12, fill: hex(SKIN) }),
    svg('path', {
      d:
        look.headwear === 'hat'
          ? 'M34 40 L70 40 L66 36 L62 26 L42 26 L38 36 Z'
          : look.headwear === 'turban'
            ? 'M39 42 Q38 28 52 27 Q66 28 65 42 Q52 36 39 42 Z'
            : 'M40 40 Q41 30 52 30 Q63 30 64 40 Z',
      fill: hex(look.trim),
    }),
    svg('circle', { cx: 48, cy: 47, r: 1.4, class: 'shop-figure__eye' }),
    svg('circle', { cx: 56, cy: 47, r: 1.4, class: 'shop-figure__eye' }),
    // Dyo, the ink drop, in the inkwell's color.
    svg('path', {
      d: 'M104 102 Q96 116 98 122 Q104 132 112 124 Q114 116 104 102 Z',
      fill: hex(dyo[0]),
    }),
    svg('ellipse', { cx: 101, cy: 116, rx: 2, ry: 4, fill: hex(dyo[1]), opacity: 0.7 }),
    svg('circle', { cx: 103, cy: 119, r: 2, fill: '#fff' }),
    svg('circle', { cx: 109, cy: 119, r: 2, fill: '#fff' }),
    svg('circle', { cx: 103.5, cy: 119.5, r: 1, class: 'shop-figure__eye' }),
    svg('circle', { cx: 109.5, cy: 119.5, r: 1, class: 'shop-figure__eye' }),
  );
  return root;
}

/** Color dots for an item (its swatch). */
function swatch(item: ShopItem): HTMLElement {
  const el = h('span', { class: 'shop-swatch', 'aria-hidden': 'true' });
  for (const c of item.colors.slice(0, 4)) {
    const dot = h('span', { class: 'shop-swatch__dot' });
    dot.style.background = hex(c);
    el.append(dot);
  }
  return el;
}

export function shopScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const profile = ctx.profile;
  const name = (k: string): string => t.t(k as MessageKey);
  const regionName = (id: string): string => t.t(`region.${id}` as MessageKey);

  /** Saves a change, plays its sound, says it in a toast, and draws the shop again. */
  function change(
    fn: (p: typeof profile) => boolean,
    sound: 'unlock' | 'success' | 'tier' | 'ui-toggle',
    note: string,
  ): void {
    let ok = false;
    ctx.saves.update((p) => {
      ok = fn(p);
    });
    if (!ok) {
      ctx.audio.play('ui-error');
      return;
    }
    void ctx.saves.flush();
    ctx.audio.play(sound);
    if (note) ctx.toast.show(note);
    ctx.refresh();
  }

  // --- Header: level, wallet, the apprentice.
  const pts = skillPoints(profile);
  const wallet = h(
    'div',
    { class: 'shop-wallet' },
    h(
      'span',
      { class: 'shop-wallet__item', 'data-testid': 'wallet-glyphs' },
      h('span', { class: 'shop-wallet__label', text: t.t('range.results.glyphs') }),
      h('strong', { text: String(profile.wallet.glyphs) }),
    ),
    h(
      'span',
      { class: 'shop-wallet__item', 'data-testid': 'wallet-ink' },
      h('span', { class: 'shop-wallet__label', text: t.t('range.results.ink') }),
      h('strong', { text: String(profile.wallet.ink) }),
    ),
    h(
      'span',
      { class: 'shop-wallet__item', 'data-testid': 'wallet-points' },
      h('span', { class: 'shop-wallet__label', text: t.t('shop.points') }),
      h('strong', { text: String(pts.free) }),
    ),
  );
  const head = h(
    'div',
    { class: 'shop-head' },
    figure(dressedLook(profile), dressOf(profile).ink, t.t('shop.figure')),
    h('div', { class: 'shop-head__body' }, levelBar(t, profile), wallet),
  );

  // --- The shelf.
  const level = levelOf(profile.progress.xp).level;
  const cost = (item: ShopItem): string => {
    const parts: string[] = [];
    if (item.cost.glyphs > 0) parts.push(t.t('shop.costGlyphs', { n: item.cost.glyphs }));
    if (item.cost.ink > 0) parts.push(t.t('shop.costInk', { n: item.cost.ink }));
    return parts.join(' · ');
  };

  const itemCard = (item: ShopItem): HTMLElement => {
    const st = itemState(profile, item);
    const nm = itemName(t, item.id);
    const actions: HTMLElement[] = [];
    let chip: HTMLElement;
    switch (st) {
      case 'equipped':
        chip = status(t.t('shop.wearing'), 'gold');
        actions.push(
          button({
            label: t.t('shop.takeOff'),
            small: true,
            variant: 'quiet',
            onClick: () => change((p) => equipItem(p, null, item.slot), 'ui-toggle', ''),
          }),
        );
        break;
      case 'owned':
        if (item.slot === 'decor') {
          const shown = decorShown(profile).includes(item.id);
          chip = status(t.t(shown ? 'shop.inHouse' : 'shop.putAway'), shown ? 'gold' : 'neutral');
          actions.push(
            button({
              label: t.t(shown ? 'shop.hide' : 'shop.show'),
              small: true,
              variant: 'quiet',
              onClick: () => change((p) => toggleDecor(p, item.id), 'ui-toggle', ''),
            }),
          );
        } else {
          chip = status(t.t('shop.owned'), 'ok');
          actions.push(
            button({
              label: t.t('shop.wear'),
              small: true,
              onClick: () =>
                change(
                  (p) => equipItem(p, item.id, item.slot),
                  'ui-toggle',
                  t.t('shop.woreNote', { item: nm }),
                ),
            }),
          );
        }
        break;
      case 'buy':
        chip = status(cost(item), 'neutral');
        actions.push(
          button({
            label: t.t('shop.buy'),
            small: true,
            variant: 'primary',
            onClick: () =>
              change((p) => buyItem(p, item.id), 'unlock', t.t('shop.boughtNote', { item: nm })),
          }),
        );
        break;
      case 'poor':
        chip = status(cost(item), 'warn');
        actions.push(h('span', { class: 'shop-card__why', text: t.t('shop.needMore') }));
        break;
      case 'craft':
        chip = status(t.t('shop.crafted'), 'neutral');
        actions.push(h('span', { class: 'shop-card__why', text: t.t('shop.craftHint') }));
        break;
      default:
        chip = status(t.t('shop.atLevel', { level: item.level }));
        break;
    }
    return h(
      'li',
      { class: `shop-card shop-card--${st}`, 'data-item': item.id, 'data-state': st },
      panel(
        {},
        h(
          'div',
          { class: 'shop-card__head' },
          swatch(item),
          h('h3', { class: 'shop-card__name', text: nm }),
        ),
        h('p', { class: 'shop-card__body', text: name(`shop.desc.${item.id.replace(':', '.')}`) }),
        h('div', { class: 'shop-card__foot' }, chip, ...actions),
      ),
    );
  };

  const SLOT_ORDER: readonly ItemSlot[] = ['robe', 'quill', 'ink', 'decor'];
  const shelf = (): HTMLElement =>
    h(
      'div',
      { class: 'shop-shelf' },
      ...SLOT_ORDER.map((slot) =>
        h(
          'section',
          { class: 'shop-group', 'data-slot': slot },
          h('h2', { class: 'shop-group__title', text: t.t(`shop.slot.${slot}` as MessageKey) }),
          h(
            'ul',
            { class: 'shop-grid' },
            ...ITEMS.filter((i) => i.slot === slot && !i.crafted).map(itemCard),
          ),
        ),
      ),
    );

  // --- Crafting.
  const crafting = (): HTMLElement =>
    h(
      'div',
      {},
      h('p', { class: 'shop-lead', text: t.t('shop.craftLead') }),
      h(
        'ul',
        { class: 'shop-grid' },
        ...RECIPES.map((r) => {
          const item = shopItem(r.makes) as ShopItem;
          const st = recipeState(profile, r);
          const nm = itemName(t, r.makes);
          const needs = [
            t.t('shop.recipe.from', { item: itemName(t, r.from) }),
            t.t('shop.recipe.letters', {
              have: Math.min(profile.progress.secrets.length, r.letters),
              n: r.letters,
            }),
            t.t('shop.costInk', { n: item.cost.ink }),
          ];
          const why: Record<typeof st, string> = {
            made: t.t('shop.recipe.made'),
            ready: t.t('shop.recipe.ready'),
            needsPiece: t.t('shop.recipe.needsPiece', { item: itemName(t, r.from) }),
            needsLetters: t.t('shop.recipe.needsLetters'),
            needsInk: t.t('shop.needMore'),
            needsLevel: t.t('shop.atLevel', { level: item.level }),
          };
          return h(
            'li',
            { class: `shop-card shop-card--${st}`, 'data-recipe': r.makes, 'data-state': st },
            panel(
              {},
              h(
                'div',
                { class: 'shop-card__head' },
                swatch(item),
                h('h3', { class: 'shop-card__name', text: nm }),
              ),
              h('p', {
                class: 'shop-card__body',
                text: name(`shop.desc.${r.makes.replace(':', '.')}`),
              }),
              h('ul', { class: 'shop-needs' }, ...needs.map((n) => h('li', { text: n }))),
              h(
                'div',
                { class: 'shop-card__foot' },
                status(why[st], st === 'made' ? 'gold' : st === 'ready' ? 'ok' : 'neutral'),
                st === 'ready'
                  ? button({
                      label: t.t('shop.craft'),
                      small: true,
                      variant: 'primary',
                      onClick: () =>
                        change(
                          (p) => craft(p, r.makes),
                          'success',
                          t.t('shop.craftedNote', { item: nm }),
                        ),
                    })
                  : '',
              ),
            ),
          );
        }),
      ),
    );

  // --- Skills.
  const skillCard = (id: AbilityId): HTMLElement => {
    const st = skillState(profile, id);
    const node = SKILLS.find((s) => s.id === id);
    const off = profile.progress.off.includes(id);
    const learned = st === 'learned';
    const label: Record<typeof st, string> = {
      learned: off ? t.t('shop.skill.off') : t.t('shop.skill.on'),
      ready: t.t('shop.skill.ready'),
      needsLevel: t.t('shop.atLevel', { level: node?.level ?? 1 }),
      needsPrev: t.t('shop.skill.needsPrev'),
      needsPoint: t.t('shop.skill.needsPoint'),
    };
    const actions: HTMLElement[] = [];
    if (st === 'ready') {
      actions.push(
        button({
          label: t.t('shop.skill.learn'),
          small: true,
          variant: 'primary',
          onClick: () =>
            change(
              (p) => learnSkill(p, id),
              'tier',
              t.t('shop.skill.learnedNote', { skill: name(`ability.${id}.name`) }),
            ),
        }),
      );
    } else if (learned && node?.inRun) {
      actions.push(
        button({
          label: t.t(off ? 'shop.skill.turnOn' : 'shop.skill.turnOff'),
          small: true,
          variant: 'quiet',
          onClick: () => change((p) => toggleSkill(p, id), 'ui-toggle', ''),
        }),
      );
    }
    return h(
      'li',
      {
        class: `skill skill--${learned ? (off ? 'off' : 'learned') : st}`,
        'data-skill': id,
        'data-state': st,
      },
      h('span', { class: 'skill__step', 'aria-hidden': 'true', text: String(node?.step ?? 1) }),
      h(
        'div',
        { class: 'skill__body' },
        h('h3', { class: 'skill__name', text: name(`ability.${id}.name`) }),
        h('p', { class: 'skill__desc', text: name(`ability.${id}.desc`) }),
        h(
          'div',
          { class: 'skill__foot' },
          status(label[st], learned && !off ? 'gold' : st === 'ready' ? 'ok' : 'neutral'),
          ...actions,
        ),
      ),
    );
  };
  const skills = (): HTMLElement =>
    h(
      'div',
      {},
      h('p', {
        class: 'shop-lead',
        text: t.t('shop.skillLead', { free: pts.free, total: pts.total }),
      }),
      h(
        'div',
        { class: 'skill-tree' },
        ...BRANCHES.map((b) =>
          h(
            'section',
            { class: `skill-branch skill-branch--${b}`, 'data-branch': b },
            h('h2', { class: 'skill-branch__title', text: t.t(`shop.branch.${b}` as MessageKey) }),
            h(
              'ol',
              { class: 'skill-branch__list' },
              ...SKILLS.filter((s) => s.branch === b).map((s) => skillCard(s.id)),
            ),
          ),
        ),
      ),
    );

  // --- Hidden letters.
  const statuses = regionStatuses(profile);
  const letters = (): HTMLElement => {
    const found = profile.progress.secrets;
    return h(
      'div',
      {},
      h('p', {
        class: 'shop-lead',
        text: t.t('shop.lettersLead', { found: found.length, total: SECRETS.length }),
      }),
      h(
        'ul',
        { class: 'letter-grid' },
        ...SECRETS.map((sec) => {
          const got = found.includes(sec.region);
          const open = statuses.find((x) => x.id === sec.region)?.open ?? sec.region === 'blot';
          return h(
            'li',
            {
              class: got ? 'letter-tile letter-tile--found' : 'letter-tile',
              'data-region': sec.region,
              'data-found': String(got),
            },
            h('span', {
              class: 'letter-tile__glyph',
              'aria-hidden': 'true',
              text: got ? sec.letter : '?',
            }),
            h('span', { class: 'letter-tile__place', text: regionName(sec.region) }),
            h('span', {
              class: 'letter-tile__hint',
              text: got
                ? t.t('shop.letterFound')
                : open
                  ? name(`secret.${sec.region}`)
                  : t.t('shop.letterLocked'),
            }),
          );
        }),
      ),
    );
  };

  const tb = tabs(
    [
      { id: 'shelf', label: t.t('shop.tab.shelf'), content: shelf },
      { id: 'craft', label: t.t('shop.tab.craft'), content: crafting },
      {
        id: 'skills',
        label: pts.free > 0 ? t.t('shop.tab.skillsFree', { n: pts.free }) : t.t('shop.tab.skills'),
        content: skills,
      },
      { id: 'letters', label: t.t('shop.tab.letters'), content: letters },
    ],
    t.t('shop.tabs'),
    lastTab,
  );
  tb.el.addEventListener('click', (ev) => {
    const id = (ev.target as HTMLElement).closest<HTMLElement>('[data-tab]')?.dataset.tab;
    if (id) lastTab = id;
  });

  const el = frame(
    { title: t.t('shop.title'), lead: t.t(level > 1 ? 'shop.lead' : 'shop.leadNew') },
    head,
    tb.el,
    h(
      'div',
      { class: 'page__actions' },
      button({ label: t.t('shop.home'), onClick: () => ctx.go('hub') }),
    ),
  );
  el.dataset.testid = 'shop';
  el.classList.add('shop');
  return {
    el,
    wide: true,
    focus: () =>
      el
        .querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
        ?.focus({ preventScroll: true }),
  };
}
