// The Game Room (#/arcade, opened from the hub's Game Room door): the arcade lobby (T29). Games
// are grouped as 3D Classics, New Generation and Quick Games. The five 3D classics (Word Galaxy,
// Hall of Sefarim, Grand Prix, Key Arena, Tower of Precision) run in an iframe
// (public/arcade/arcade.html) through the bridge in src/arcade: the page is told the layout, the
// language, the colours, the letters the player has learned and his weak keys, and every word it
// may use is made of learned letters. The games' own scores and settings come back as the
// profile's `arcade` blob. T30 adds the other eleven: the new generation (Letter Dash, Rhythm,
// Fortress and the five "+" versions with perks, target letters and coins), the quick 2D games
// (Letter Rain, Word Rain, Storm), the daily challenge and the booster shop.

import {
  CLASSIC_GAMES,
  FLAT_BEST,
  NEWGEN_GAMES,
  QUICK_GAMES,
  buildInit,
  coinsOf,
  parseMessage,
  readBlob,
  type ArcadeGameId,
  type ArcadeTheme,
} from '../../arcade';
import { knownKeysOf, weakCharacters } from '../../learn';
import type { AppContext, Screen } from '../app';
import { button, panel } from '../components';
import { h } from '../dom';
import type { MessageKey } from '../i18n';
import { frame } from './frame';
import { resolveTheme, systemPrefersDark } from '../theme';

const ICONS: Readonly<Record<string, string>> = {
  galaxy: '🚀',
  sefarim: '📚',
  race: '🏁',
  arena: '🔨',
  tower: '🏗️',
  runner: '🏃',
  rhythm: '🎵',
  fortress: '🏰',
  galaxyPlus: '🚀',
  towerPlus: '🏗️',
  arenaPlus: '🔨',
  racePlus: '🏎️',
  sefarimPlus: '📚',
  letterRain: '🔤',
  wordRain: '🌧️',
  storm: '⛈️',
};

interface ArcadeProbe {
  lobby: boolean;
  game: string | null;
  ready: boolean;
  letters: number;
  layout: string;
  saved: number;
}

declare global {
  interface Window {
    __otiyotArcade?: ArcadeProbe;
  }
}

/** The best score a game has kept, over every mode and difficulty (0: none yet). */
export function bestScore(blob: unknown, id: string): number {
  const flat = FLAT_BEST[id];
  if (flat !== undefined) {
    const n = readBlob(blob).games[flat];
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
  }
  const scores = readBlob(blob).games3d.scores;
  if (scores === null || typeof scores !== 'object') return 0;
  const byKey = (scores as Record<string, unknown>)[id];
  if (byKey === null || typeof byKey !== 'object') return 0;
  let best = 0;
  for (const list of Object.values(byKey as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const n = (row as { score?: unknown } | null)?.score;
      if (typeof n === 'number' && Number.isFinite(n) && n > best) best = n;
    }
  }
  return best;
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function arcadeScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const probe: ArcadeProbe = {
    lobby: true,
    game: null,
    ready: false,
    letters: 0,
    layout: ctx.profile.layout,
    saved: 0,
  };
  window.__otiyotArcade = probe;

  const root = h('div', { class: 'arcade' });
  let frameEl: HTMLIFrameElement | null = null;
  let disposed = false;
  let gameId: ArcadeGameId | null = null;

  const theme = (): ArcadeTheme => {
    const p = ctx.profile.settings;
    const dark = resolveTheme(p.theme, systemPrefersDark()) === 'dark';
    return {
      dark,
      page: cssVar('--page', dark ? '#17130e' : '#f6eedb'),
      ink: cssVar('--ink', dark ? '#f1e7d2' : '#2a2218'),
      gold: cssVar('--gold', '#c9972b'),
      line: cssVar('--line', dark ? '#3a3226' : '#d2c4a4'),
      onGold: cssVar('--on-gold', '#1c1408'),
    };
  };

  const sendInit = (): void => {
    if (!frameEl?.contentWindow || gameId === null) return;
    const profile = ctx.profile;
    const known = knownKeysOf(profile);
    const weak = weakCharacters(profile, known, 5).map((w) => w.ch);
    const init = buildInit({
      layout: profile.layout,
      uiLang: t.lang,
      theme: theme(),
      known,
      weak,
      blob: profile.arcade,
      game: gameId,
    });
    probe.letters = init.letters.length;
    frameEl.contentWindow.postMessage({ type: 'otiyot:init', payload: init }, '*');
  };

  const onMessage = (ev: MessageEvent): void => {
    if (disposed || !frameEl || ev.source !== frameEl.contentWindow) return;
    const msg = parseMessage(ev.data);
    if (!msg) return;
    if (msg.type === 'otiyot:ready') {
      probe.ready = true;
      sendInit();
    } else if (msg.type === 'otiyot:save') {
      ctx.saves.update((p) => {
        p.arcade = msg.blob as unknown as typeof p.arcade;
      });
      probe.saved += 1;
    } else {
      closeGame();
    }
  };
  window.addEventListener('message', onMessage);

  function closeGame(): void {
    if (!frameEl) return;
    frameEl.remove();
    frameEl = null;
    gameId = null;
    probe.game = null;
    probe.ready = false;
    probe.lobby = true;
    root.replaceChildren(lobby());
    ctx.audio.music('arcade');
  }

  function gameTitle(id: ArcadeGameId): string {
    if (id === 'daily') return t.t('arcade.daily');
    if (id === 'shop') return t.t('arcade.shop');
    return t.t(`arcade.game.${id}.name` as MessageKey);
  }

  function openGame(id: ArcadeGameId): void {
    gameId = id;
    probe.game = id;
    probe.lobby = false;
    probe.ready = false;
    // The classic games bring their own sound: the lobby's tune steps aside while one runs.
    ctx.audio.music(null);
    const f = h('iframe', {
      class: 'arcade__frame',
      title: gameTitle(id),
      src: `${import.meta.env.BASE_URL}arcade/arcade.html`,
      allow: 'autoplay',
    });
    f.addEventListener('load', () => f.focus());
    frameEl = f;
    root.replaceChildren(
      h(
        'div',
        { class: 'arcade__bar' },
        button({
          label: t.t('arcade.backToLobby'),
          icon: 'back',
          flipIcon: true,
          small: true,
          onClick: closeGame,
        }),
      ),
      f,
    );
  }

  function card(id: Exclude<ArcadeGameId, 'daily' | 'shop'>): HTMLElement {
    const best = bestScore(ctx.profile.arcade, id);
    return panel(
      { class: 'arcade__card' },
      h('div', { class: 'arcade__icon', 'aria-hidden': 'true', text: ICONS[id] }),
      h('h3', { text: t.t(`arcade.game.${id}.name` as MessageKey) }),
      h('p', { text: t.t(`arcade.game.${id}.desc` as MessageKey) }),
      h('p', {
        class: 'arcade__best',
        text: best > 0 ? t.t('arcade.best', { n: best.toLocaleString() }) : t.t('arcade.noBest'),
      }),
      button({
        label: t.t('arcade.play'),
        variant: 'primary',
        onClick: () => openGame(id),
      }),
    );
  }

  function lobby(): HTMLElement {
    const group = (key: 'classics' | 'newgen' | 'quick', cards: HTMLElement[]): HTMLElement =>
      h(
        'section',
        { class: 'arcade__group', 'data-group': key },
        h('h2', { text: t.t(`arcade.group.${key}` as MessageKey) }),
        h('div', { class: 'arcade__grid' }, ...cards),
      );
    const coins = coinsOf(ctx.profile.arcade);
    const extras = panel(
      { class: 'arcade__extras' },
      h('p', {
        class: 'arcade__coins',
        'data-coins': String(coins),
        text: t.t('arcade.coins', { n: coins.toLocaleString() }),
      }),
      h(
        'div',
        { class: 'arcade__extras-buttons' },
        button({
          label: t.t('arcade.daily'),
          variant: 'primary',
          small: true,
          onClick: () => openGame('daily'),
        }),
        button({ label: t.t('arcade.shop'), small: true, onClick: () => openGame('shop') }),
      ),
      h('p', { class: 'arcade__hint', text: t.t('arcade.extrasHint') }),
    );
    return frame(
      { title: t.t('hub.station.gameRoom'), lead: t.t('arcade.lead') },
      extras,
      group(
        'classics',
        CLASSIC_GAMES.map((id) => card(id)),
      ),
      group(
        'newgen',
        NEWGEN_GAMES.map((id) => card(id)),
      ),
      group(
        'quick',
        QUICK_GAMES.map((id) => card(id)),
      ),
    );
  }

  root.append(lobby());
  // T34: the Game Room has its own tune.
  ctx.audio.music('arcade');

  return {
    el: root,
    wide: true,
    onEscape: () => {
      if (frameEl) {
        closeGame();
        return true;
      }
      return false;
    },
    dispose: () => {
      disposed = true;
      window.removeEventListener('message', onMessage);
      frameEl?.remove();
      if (window.__otiyotArcade === probe) delete window.__otiyotArcade;
    },
  };
}
