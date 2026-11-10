// Players: switch, add, rename, delete. Names are user text and may be in either script.

import { MAX_NAME } from '../../save';
import type { AppContext, Screen } from '../app';
import { button, menu, openModal, status, type MenuItem } from '../components';
import { h } from '../dom';
import { frame, keysHint } from './frame';
import { layoutName, trackName } from './names';

export function playersScreen(ctx: AppContext): Screen {
  const t = ctx.i18n;
  const active = ctx.profile;

  const items: MenuItem[] = ctx.saves.save.profiles.map((p) => ({
    id: p.id,
    label: p.name,
    foreign: true,
    hint: t.t('players.summary', { track: trackName(t, p.track), layout: layoutName(t, p.layout) }),
    chosen: p.id === active.id,
    end: p.id === active.id ? status(t.t('players.active'), 'gold') : undefined,
    onChoose: () => {
      if (p.id !== active.id) {
        ctx.saves.switchProfile(p.id);
        ctx.toast.show(t.t('players.switched', { name: p.name }), 'ok');
      }
      ctx.go('menu');
    },
  }));
  const list = menu(items, { label: t.t('players.list') });

  const rename = (): void => {
    const input = h('input', {
      class: 'input input--name',
      type: 'text',
      maxlength: MAX_NAME,
      dir: 'auto',
      autocomplete: 'off',
      'aria-label': t.t('wizard.nameLabel'),
    });
    input.value = active.name;
    const apply = (): void => {
      ctx.saves.renameProfile(active.id, input.value);
      ctx.toast.show(t.t('players.renamed', { name: ctx.profile.name }), 'ok');
      ctx.refresh();
    };
    const modal = openModal({
      title: t.t('players.renameTitle', { name: active.name }),
      body: input,
      actions: [
        { label: t.t('common.cancel'), variant: 'quiet' },
        { label: t.t('common.save'), variant: 'primary', onClick: apply },
      ],
      onKey: (ev) => {
        if (ev.key !== 'Enter' || ev.target !== input) return false;
        modal.close();
        apply();
        return true;
      },
    });
    input.select();
  };

  const remove = (): void => {
    openModal({
      title: t.t('players.deleteTitle', { name: active.name }),
      body: t.t('players.deleteBody'),
      actions: [
        { label: t.t('common.cancel'), variant: 'quiet' },
        {
          label: t.t('players.deleteYes'),
          variant: 'danger',
          onClick: () => {
            const name = active.name;
            ctx.saves.deleteProfile(active.id);
            ctx.toast.show(t.t('players.deleted', { name }), 'warn');
            ctx.refresh();
          },
        },
      ],
    });
  };

  const add = button({
    label: t.t('players.new'),
    variant: 'primary',
    icon: 'plus',
    onClick: () => ctx.go('players/new'),
  });
  add.dataset.action = 'new-player';
  const actions = h(
    'div',
    { class: 'page__actions' },
    add,
    button({ label: t.t('players.rename'), icon: 'pencil', onClick: rename }),
    button({ label: t.t('players.delete'), variant: 'danger', icon: 'trash', onClick: remove }),
  );

  const el = frame(
    { title: t.t('players.title'), lead: t.t('players.lead') },
    list.el,
    actions,
    keysHint(t.t('common.keysHint')),
  );
  return { el, onKey: list.onKey, focus: list.focus };
}
