import './ui/styles/index.css';
import { detectStore, SaveManager } from './save';
import type { Route, ScreenFactory } from './ui/app';
import { Shell } from './ui/shell';

// Pick the save home (Otzaria or the browser) and write on close.
export const saves = new SaveManager(detectStore());
window.addEventListener('pagehide', () => void saves.flush());

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  const loaded = await saves.load();
  const extraScreens: Partial<Record<Route, ScreenFactory>> = {};
  // The styleguide is for development only and is left out of the real build.
  if (import.meta.env.DEV) {
    extraScreens.styleguide = (await import('./ui/screens/styleguide')).styleguideScreen;
  }
  new Shell({ root, saves, loaded, extraScreens }).start();
}

void boot();
