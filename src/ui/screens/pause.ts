// Pause menu: a modal over whatever is running. Scenes open it through the shell (T08 onward).

import type { AppContext } from '../app';
import { menu, openModal, type MenuItem, type ModalHandle } from '../components';

export interface PauseHandlers {
  onResume: () => void;
  /** Left out when the thing behind the pause cannot be restarted. */
  onRestart?: () => void;
  onQuit: () => void;
}

export function openPauseMenu(ctx: AppContext, handlers: PauseHandlers): ModalHandle {
  const t = ctx.i18n;
  let resumed = false;
  const leave = (then: () => void) => (): void => {
    resumed = true;
    modal.close();
    then();
  };
  const items: MenuItem[] = [
    { id: 'resume', label: t.t('pause.resume'), onChoose: leave(handlers.onResume) },
  ];
  if (handlers.onRestart) {
    items.push({ id: 'restart', label: t.t('pause.restart'), onChoose: leave(handlers.onRestart) });
  }
  items.push(
    { id: 'settings', label: t.t('pause.settings'), onChoose: leave(() => ctx.go('settings')) },
    { id: 'quit', label: t.t('pause.quit'), onChoose: leave(handlers.onQuit) },
  );
  const list = menu(items, { label: t.t('pause.menu'), compact: true });
  const modal: ModalHandle = openModal({
    title: t.t('pause.title'),
    body: list.el,
    onKey: list.onKey,
    // Esc (or a click outside) resumes, like every pause menu.
    onClose: () => {
      if (!resumed) handlers.onResume();
    },
  });
  list.focus();
  return modal;
}
