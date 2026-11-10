import { renderBoot } from './boot';
import { detectStore, SaveManager } from './save';

const root = document.getElementById('app');
if (root) renderBoot(root);

// Pick the save home (Otzaria or the browser), load in the background, and write on close.
export const saves = new SaveManager(detectStore());
void saves.load();
window.addEventListener('pagehide', () => void saves.flush());
