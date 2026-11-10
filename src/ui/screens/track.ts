// Lesson track picker for the active player.

import type { AppContext, Screen } from '../app';
import { h } from '../dom';
import { frame, keysHint } from './frame';
import { trackName } from './names';
import { trackPicker } from './pickers';

export function trackScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const p = ctx.profile;
  const pick = trackPicker(t, p.layout, p.track, (track) => {
    ctx.saves.update((prof) => {
      prof.track = track;
    });
    ctx.toast.show(t.t('track.changed', { name: trackName(t, track) }), 'ok');
  });
  const el = frame(
    { title: t.t('track.title'), lead: t.t('track.lead') },
    pick.el,
    h('p', { class: 'page__note', text: t.t('track.note') }),
    keysHint(t.t('common.keysHint')),
  );
  return { el, onKey: pick.onKey, focus: pick.focus, wide: true };
}
