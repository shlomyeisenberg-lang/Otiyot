// Keyboard layout picker for the active player.

import type { AppContext, Screen } from '../app';
import { frame, keysHint } from './frame';
import { layoutName } from './names';
import { layoutPicker } from './pickers';

export function layoutScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const pick = layoutPicker(t, ctx.profile.layout, (layout) => {
    ctx.saves.update((prof) => {
      prof.layout = layout;
    });
    ctx.toast.show(t.t('layout.changed', { name: layoutName(t, layout) }), 'ok');
  });
  const el = frame(
    { title: t.t('layout.title'), lead: t.t('layout.lead') },
    pick.el,
    keysHint(t.t('common.keysHint')),
  );
  return { el, onKey: pick.onKey, focus: pick.focus, wide: true };
}
