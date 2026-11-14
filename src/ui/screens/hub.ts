// The House of the Scribe (T13): the game's home base and its menu. The 3D house fills the
// screen; every station carries a door word made of letters the player has learned, and typing
// it walks the apprentice there and opens it: the desk (the map of the land: what is restored,
// what is open, the levels, and what to learn first), the practice slate (the next lesson), the
// trophy shelf (ranks), the ink shop (T33), the journal (T32), the Game Room (the arcade, T29), and the tool chest (settings). Reb Ezra and Dyo greet
// the player with a line that fits the moment. The same stations sit in a row at the bottom for
// the mouse and screen readers, and they are all there is when the device cannot draw 3D.

import type { Vector3 } from 'three';
import { charForKey, resolveTypedChar } from '../../core';
import { DoorPicker, doorWords } from '../../game/doors';
import { LEVELS, type LevelId } from '../../game/levels';
import {
  nextRegion,
  regionStatuses,
  REGION_IDS,
  restoredShare,
  STORY_REGIONS,
  type RegionId,
  type RegionStatus,
} from '../../game/regions';
import { eligibleWords, findNextLesson, getProgress, getTrack, knownKeysOf } from '../../learn';
import type { HubScene, StationId } from '../../scenes/hub';
import { CAST, fillLine, hubLine, partOfDay, type HubMoment } from '../../story';
import type { AppContext, Screen } from '../app';
import { button, dialogueBox, openModal, rankBadge, status, type ModalHandle } from '../components';
import { h } from '../dom';
import { decorShown, dressOf, dressedLook, shopItem } from '../../game/progression';
import type { MessageKey } from '../i18n';
import { enterRegion, pendingRestoration, wantChapter } from '../chapterQueue';
import { playableRegions, SCENE_ROUTES, wantLesson } from '../playable';
import type { Stage3d } from '../stage3d';

const STATIONS: readonly StationId[] = [
  'desk',
  'practice',
  'trophies',
  'shop',
  'journal',
  'gameRoom',
  'settings',
];
/** Stations whose rooms are built by later tasks: they say so in the world and in the panel. */
const SOON: ReadonlySet<StationId> = new Set<StationId>([]);
/** Minutes of real time for one whole day in the house. */
const DAY_MINUTES = 12;
const LINE_MS = 9000;

interface HubProbe {
  ready: boolean;
  failed: boolean;
  doors: Record<string, string>;
  typed: string;
  at: string | null;
  opened: string | null;
  walking: boolean;
  restored: number;
  litBeacons: number;
  hour: number;
  line: string;
  leaked: number | null;
  /** Runs the world forward without waiting for the clock (tests). */
  step: (seconds: number) => void;
}

declare global {
  interface Window {
    __otiyotHub?: HubProbe;
  }
}

export function hubScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const profile = ctx.profile;
  const lang = t.lang;
  const layout = profile.layout;
  const probe: HubProbe = {
    ready: false,
    failed: false,
    doors: {},
    typed: '',
    at: null,
    opened: null,
    walking: false,
    restored: 0,
    litBeacons: 0,
    hour: 0,
    line: '',
    leaked: null,
    step: (seconds) => stage?.engine.simulate(seconds),
  };
  window.__otiyotHub = probe;

  // --- What the land looks like now, and what changed since the last visit.
  const statuses = regionStatuses(profile);
  const share = restoredShare(profile);
  const fresh: number[] = [];
  REGION_IDS.forEach((id, i) => {
    const s = statuses[i] as RegionStatus;
    if (s.restored && profile.story.flags[`hub:${id}`] !== true) fresh.push(i);
  });
  const freshStory = fresh.filter((i) => STORY_REGIONS.includes(REGION_IDS[i] as RegionId));
  const before = share - freshStory.length / STORY_REGIONS.length;
  const firstVisit = profile.story.flags.hub !== true;
  ctx.saves.update((p) => {
    p.story.flags.hub = true;
    for (const i of fresh) p.story.flags[`hub:${REGION_IDS[i] as string}`] = true;
  });
  probe.restored = share;
  probe.litBeacons = statuses.filter((s) => s.restored).length;

  // --- Door words: only letters this player has learned (ARCHITECTURE 8).
  const keys = knownKeysOf(profile);
  let letters = [...keys].filter((c) => /\p{L}/u.test(c));
  if (letters.length < 2) {
    // A brand-new player still knows the two index-finger keys of the home row.
    letters = [charForKey(layout, 'KeyF', false), charForKey(layout, 'KeyJ', false)].filter(
      (c): c is string => typeof c === 'string',
    );
  }
  const seed = (Date.now() / 1000) | 0;
  let s = seed % 2147483647 || 1;
  const rng = (): number => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const pool = eligibleWords({ language: layout, allowedChars: keys, minLength: 2, maxLength: 5 });
  const words = doorWords({
    letters,
    pool,
    count: STATIONS.length,
    rng,
    language: layout,
  }).map((w) => (layout === 'en' ? w.toLowerCase() : w));
  const picker = new DoorPicker(words);
  STATIONS.forEach((id, i) => (probe.doors[id] = words[i] ?? ''));
  const rtl = layout === 'he';

  const name = (id: StationId): string => t.t(`hub.station.${id}` as MessageKey);
  const regionName = (id: RegionId): string => t.t(`region.${id}` as MessageKey);

  // --- The page.
  const view = h('div', { class: 'hub__view' });
  const tags = h('div', { class: 'hub__tags', 'aria-hidden': 'true' });
  const tagEls = STATIONS.map((id) => {
    const tag = h('span', { class: 'hub__tag', text: name(id) });
    if (SOON.has(id)) tag.dataset.soon = 'true';
    tags.append(tag);
    return tag;
  });
  const typedEl = h('p', { class: 'hub__typed', dir: rtl ? 'rtl' : 'ltr', 'aria-live': 'polite' });
  const rail = h('nav', { class: 'hub__rail', 'aria-label': t.t('hub.rail') });
  const railBtns = STATIONS.map((id, i) => {
    const word = words[i] ?? '';
    const b = h(
      'button',
      {
        class: 'hub__door',
        type: 'button',
        'data-station': id,
        'aria-label': t.t('hub.doorLabel', { station: name(id), word }),
      },
      h('span', { class: 'hub__door-name', text: name(id) }),
      h(
        'span',
        { class: 'hub__door-word', lang: layout, dir: rtl ? 'rtl' : 'ltr' },
        ...Array.from(word).map((ch) => h('span', { class: 'hub__door-letter', text: ch })),
      ),
    );
    if (SOON.has(id)) b.dataset.soon = 'true';
    b.addEventListener('click', () => choose(id));
    rail.append(b);
    return b;
  });
  const hint = h('p', { class: 'hub__hint', text: t.t('hub.hint') });
  const loading = h('p', { class: 'hub__loading', text: t.t('hub.loading') });
  const speech = dialogueBox({
    speaker: '',
    text: '',
    nextHint: t.t('hub.lineHide'),
    nextKey: 'Enter',
    onNext: () => hideLine(),
  });
  speech.el.classList.add('hub__speech');
  speech.el.hidden = true;
  const el = h(
    'section',
    { class: 'hub', 'data-testid': 'hub', 'aria-label': t.t('hub.title') },
    view,
    tags,
    loading,
    speech.el,
    h('div', { class: 'hub__front' }, typedEl, rail, hint),
  );

  let stage: Stage3d | null = null;
  let scene: HubScene | null = null;
  let disposed = false;
  let raf = 0;
  let lineTimer = 0;
  let modal: ModalHandle | null = null;
  let leaving = 0;

  // --- Lines from Reb Ezra, Dyo and Naftali.
  const vars = (region?: RegionId): Record<string, string> => ({
    name: profile.name,
    region: region ? regionName(region) : '',
  });
  function say(moment: HubMoment, region?: RegionId): void {
    const line = hubLine(moment, Math.floor(rng() * 1000));
    const who = CAST[line.who];
    const text = fillLine(line.text[lang], vars(region));
    speech.setLine(who.name[lang], text, undefined, who.portrait);
    speech.reveal(text.length);
    speech.setWaiting(true);
    speech.el.hidden = false;
    probe.line = `${line.who}:${text}`;
    window.clearTimeout(lineTimer);
    lineTimer = window.setTimeout(hideLine, LINE_MS);
  }
  function hideLine(): void {
    window.clearTimeout(lineTimer);
    speech.el.hidden = true;
  }
  const playable = playableRegions();
  const next = nextRegion(statuses, playable);
  function greet(): void {
    const freshRegion = fresh.map((i) => REGION_IDS[i] as RegionId).at(-1);
    const naftali = statuses.find((x) => x.id === 'rail')?.restored === true;
    if (firstVisit) say('first');
    else if (freshRegion) say('restored', freshRegion);
    else if (statuses.filter((x) => x.act > 0).every((x) => x.restored)) say('all');
    else if (naftali && rng() < 0.3) say('naftali');
    else if (next && rng() < 0.5) say('next', next.id);
    else say(partOfDay(new Date().getHours()));
  }

  // --- Typing a door word.
  const showTyped = (): void => {
    probe.typed = picker.typed;
    typedEl.textContent = picker.typed;
    railBtns.forEach((b, i) => {
      const live = picker.typed.length > 0 && picker.matches(i);
      b.dataset.match = picker.typed.length === 0 ? '' : live ? 'yes' : 'no';
      const letterEls = b.querySelectorAll('.hub__door-letter');
      letterEls.forEach((le, k) => {
        (le as HTMLElement).dataset.state =
          live && k < picker.typed.length ? 'ok' : live && k === picker.typed.length ? 'next' : '';
      });
    });
    scene?.setTyped(picker.typed);
  };

  function choose(id: StationId): void {
    if (modal || leaving) return;
    picker.reset();
    showTyped();
    hideLine();
    probe.opened = null;
    if (scene) {
      scene.walkTo(id);
    } else {
      ctx.audio.play('word');
      arrive(id);
    }
  }

  function arrive(id: StationId): void {
    probe.at = id;
    if (disposed) return;
    switch (id) {
      case 'desk':
        openMap();
        break;
      case 'practice':
        leave('modes');
        break;
      case 'settings':
        leave('settings');
        break;
      case 'gameRoom':
        leave('arcade');
        break;
      case 'trophies':
        openTrophies();
        break;
      case 'journal':
        leave('journal');
        break;
      case 'shop':
        leave('shop');
        break;
      default:
        openSoon(id);
    }
  }

  function leave(route: 'modes' | 'settings' | 'menu' | 'arcade' | 'journal' | 'shop'): void {
    probe.opened = route;
    leaving = window.setTimeout(() => ctx.go(route), 350);
  }

  const modalHost = (): HTMLElement => el;
  function opened(id: string, m: ModalHandle): void {
    modal = m;
    probe.opened = id;
  }
  const closed = (): void => {
    modal = null;
    probe.opened = null;
  };

  // --- The desk: the map of the land.
  function regionCard(st: RegionStatus): HTMLElement {
    const play = SCENE_ROUTES[st.id];
    const card = h('article', {
      class: 'hub-map__region',
      'data-region': st.id,
      'data-state': st.restored ? 'restored' : st.open ? 'open' : 'locked',
    });
    const head = h(
      'header',
      { class: 'hub-map__head' },
      h('h3', { class: 'hub-map__name', text: regionName(st.id) }),
      st.rank
        ? rankBadge(st.rank, t.t('rank.label', { rank: st.rank }))
        : status(t.t(st.open ? 'hub.map.open' : 'hub.map.locked'), st.open ? 'gold' : 'neutral'),
    );
    card.append(
      head,
      h('p', { class: 'hub-map__place', text: t.t(`region.${st.id}.place` as MessageKey) }),
    );
    if (st.open) {
      const lv = h('div', { class: 'hub-map__levels', role: 'list' });
      for (const id of ['easy', 'standard', 'hard'] as LevelId[]) {
        const open = st.levels.includes(id);
        const chip = h('span', {
          class: 'hub-map__level',
          role: 'listitem',
          'data-open': String(open),
          'data-suggested': String(open && st.suggested === id),
          text: t.t(`range.level.${id}` as MessageKey),
        });
        chip.title = open
          ? st.suggested === id
            ? t.t('hub.map.suggested')
            : ''
          : t.t('hub.map.levelLocked', { n: LEVELS[id].needsLetters });
        lv.append(chip);
      }
      card.append(lv);
      if (play) {
        card.append(
          button({
            label: t.t(st.restored ? 'hub.map.again' : 'hub.map.play'),
            variant: st.restored ? 'default' : 'primary',
            small: true,
            onClick: () => {
              modal?.close();
              enterRegion(ctx, st.id, play);
            },
          }),
        );
      } else {
        card.append(h('p', { class: 'hub-map__note', text: t.t('hub.map.writing') }));
      }
    } else {
      card.append(h('p', { class: 'hub-map__note', text: needText(st) }));
      if (st.learn) {
        const learn = st.learn;
        card.append(
          button({
            label: t.t('hub.map.learn', { lesson: learn.nextTitle }),
            small: true,
            onClick: () => {
              modal?.close();
              wantLesson(learn.nextId);
              ctx.go('lesson');
            },
          }),
        );
      }
    }
    return card;
  }

  function needText(st: RegionStatus): string {
    if (st.waitsFor) return t.t('hub.need.after', { region: regionName(st.waitsFor) });
    const n = st.need;
    switch (n.kind) {
      case 'keys':
        return t.t(st.learn ? 'hub.need.numbers' : 'hub.need.numbersSoon');
      case 'region':
        return t.t('hub.need.region', { region: regionName(n.region) });
      case 'letters':
      case 'level':
        return st.learn
          ? t.t('hub.need.lesson', { lesson: st.learn.targetTitle, n: st.learn.remaining })
          : t.t('hub.need.course');
      default:
        return '';
    }
  }

  function openMap(): void {
    say('desk');
    const restoredCount = statuses.filter((x) => x.act > 0 && x.restored).length;
    const top = h('div', { class: 'hub-map__top' });
    if (next) {
      const go = SCENE_ROUTES[next.id];
      top.append(
        h('p', {
          class: 'hub-map__next',
          text: t.t('hub.map.next', { region: regionName(next.id) }),
        }),
      );
      if (go) {
        top.append(
          button({
            label: t.t('hub.map.continue'),
            variant: 'primary',
            onClick: () => {
              modal?.close();
              enterRegion(ctx, next.id, go);
            },
          }),
        );
      } else {
        top.append(h('p', { class: 'hub-map__note', text: t.t('hub.map.nextWriting') }));
      }
    }
    const track = getTrack(profile.track);
    const lesson = findNextLesson(
      track,
      layout,
      profile.settings.uiLanguage,
      getProgress(profile).completed,
    );
    if (lesson) {
      top.append(
        button({
          label: t.t('hub.map.lesson', { lesson: lesson.lesson.title }),
          onClick: () => {
            modal?.close();
            wantLesson(lesson.lesson.id);
            ctx.go('lesson');
          },
        }),
      );
    }
    const grid = h('div', { class: 'hub-map__grid' }, ...statuses.map(regionCard));
    const body = h(
      'div',
      { class: 'hub-map', 'data-testid': 'hub-map' },
      h('p', {
        class: 'hub-map__lead',
        text: t.t('hub.map.lead', { n: restoredCount, total: STORY_REGIONS.length }),
      }),
      top,
      grid,
    );
    const m = openModal(
      {
        title: t.t('hub.map.title'),
        body,
        actions: [{ label: t.t('common.back') }],
        onClose: closed,
      },
      modalHost(),
    );
    m.el.classList.add('modal--wide');
    opened('desk', m);
  }

  function openTrophies(): void {
    const rows = statuses
      .filter((x) => x.act > 0)
      .map((st) =>
        h(
          'li',
          { class: 'hub-trophy', 'data-region': st.id, 'data-restored': String(st.restored) },
          h('span', { class: 'hub-trophy__name', text: regionName(st.id) }),
          st.rank
            ? rankBadge(st.rank, t.t('rank.label', { rank: st.rank }))
            : h('span', { class: 'hub-trophy__none', text: t.t('hub.trophies.none') }),
        ),
      );
    const m = openModal(
      {
        title: t.t('hub.station.trophies'),
        body: h(
          'div',
          {},
          h('p', { class: 'hub-map__lead', text: t.t('hub.trophies.lead') }),
          h('ul', { class: 'hub-trophies' }, ...rows),
        ),
        actions: [{ label: t.t('common.back') }],
        onClose: closed,
      },
      modalHost(),
    );
    opened('trophies', m);
  }

  function openSoon(id: StationId): void {
    say('soon');
    const m = openModal(
      {
        title: name(id),
        body: h(
          'div',
          { class: 'hub-soon' },
          status(t.t('common.soon'), 'warn'),
          h('p', { text: t.t(`hub.soon.${id}` as MessageKey) }),
        ),
        actions: [{ label: t.t('common.back') }],
        onClose: closed,
      },
      modalHost(),
    );
    opened(id, m);
  }

  // --- Labels follow the banners on screen.
  const tick = (): void => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const sc = scene;
    const st = stage;
    if (!sc || !st || !tmp) return;
    const cam = st.engine.camera;
    const w = view.clientWidth;
    const hgt = view.clientHeight;
    for (let i = 0; i < tagEls.length; i++) {
      const a = sc.bannerAnchor(i);
      const tag = tagEls[i] as HTMLElement;
      if (!a) continue;
      const v = tmp.copy(a).project(cam);
      const on = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
      tag.style.opacity = on ? '' : '0';
      tag.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * hgt}px)`;
    }
    probe.walking = sc.probe.walking;
    probe.hour = sc.probe.hour;
    probe.restored = Math.max(probe.restored, sc.probe.restored);
  };
  let tmp: Vector3 | null = null;

  const flat = (): void => {
    probe.failed = true;
    el.dataset.flat = 'true';
    loading.hidden = true;
    ctx.audio.music('hub');
    ctx.audio.intensity(0.3);
    probe.ready = true;
    greet();
  };

  const boot = async (): Promise<void> => {
    const [{ HubScene: Scene, STATION_IDS }, { mountScene }, three] = await Promise.all([
      import('../../scenes/hub'),
      import('../stage3d'),
      import('three'),
    ]);
    if (disposed) return;
    tmp = new three.Vector3();
    const beacons = statuses.map((x) => (x.restored ? 'restored' : x.open ? 'open' : 'locked'));
    const sc = new Scene({
      look: dressedLook(profile),
      hour: new Date().getHours() + new Date().getMinutes() / 60,
      dayMinutes: DAY_MINUTES,
      restoredBefore: Math.max(0, before),
      restored: share,
      beacons,
      fresh,
      naftali: statuses.find((x) => x.id === 'rail')?.restored === true,
      slate: letters.join(''),
      soon: t.t('hub.station.gameRoom'),
      rtl,
      decor: decorShown(profile),
      decorColors: (id) => shopItem(id)?.colors ?? [],
      dyo: dressOf(profile).ink,
    });
    // The scene lists its stations in the same order as this screen.
    if (STATION_IDS.join() !== STATIONS.join()) throw new Error('hub stations out of order');
    sc.onArrive = (id) => arrive(id);
    scene = sc;
    try {
      stage = await mountScene(ctx, view, sc, 5786);
    } catch {
      scene = null;
      flat();
      return;
    }
    if (disposed) {
      stage.dispose();
      return;
    }
    sc.setDoors(words);
    loading.hidden = true;
    el.dataset.ready = 'true';
    probe.ready = true;
    raf = requestAnimationFrame(tick);
    window.setTimeout(() => {
      if (!disposed) greet();
    }, 900);
  };
  void boot().catch(flat);

  // A region restored since the player was last here: its chapter waits behind a button (once).
  const owed = pendingRestoration(profile);
  if (owed) {
    const read = button({
      label: t.t('hub.chapter.new'),
      variant: 'primary',
      small: true,
      onClick: () => {
        wantChapter(owed.id, 'hub');
        ctx.go('chapter');
      },
    });
    read.dataset.action = 'new-chapter';
    el.append(h('div', { class: 'hub__chapter' }, read));
  }

  return {
    el,
    full: true,
    ownsMusic: true,
    onKey(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey || modal || leaving) return false;
      if (ev.key === 'Enter') {
        if (!speech.el.hidden) {
          hideLine();
          return true;
        }
        // Enter on a focused station button clicks it; at a station, opens it again.
        const at = scene?.probe.at;
        if (at && !(document.activeElement instanceof HTMLButtonElement)) {
          arrive(at);
          return true;
        }
        return false;
      }
      if (ev.key === 'Backspace') {
        picker.back();
        showTyped();
        return true;
      }
      if (ev.key === ' ' || ev.key.length !== 1) return false;
      if (scene?.probe.walking) return true;
      const ch = resolveTypedChar(
        { code: ev.code, key: ev.key, shift: ev.shiftKey },
        '',
        layout,
        null,
      ).char;
      if (!ch) return false;
      const r = picker.press(layout === 'en' ? ch.toLowerCase() : ch);
      if (r.kind === 'miss') {
        ctx.audio.play('error');
        scene?.miss();
        typedEl.dataset.miss = 'true';
        window.setTimeout(() => delete typedEl.dataset.miss, 240);
        return true;
      }
      ctx.audio.play('key', r.typed.length, ch);
      showTyped();
      if (r.kind === 'done') {
        const id = STATIONS[r.index];
        if (id) choose(id);
      }
      return true;
    },
    focus() {
      el.focus?.();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(lineTimer);
      window.clearTimeout(leaving);
      modal?.close();
      modal = null;
      probe.leaked = stage ? stage.dispose() : 0;
      stage = null;
      scene = null;
    },
  };
}
