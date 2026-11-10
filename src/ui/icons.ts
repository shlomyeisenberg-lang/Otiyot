// Line icons drawn in code (no icon font, no files). 24x24, stroke = currentColor.

import { s } from './dom';

const PATHS = {
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  cross: ['M6 6l12 12', 'M18 6L6 18'],
  alert: ['M12 4l9 16H3z', 'M12 10v4.5', 'M12 17.6v.2'],
  info: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 11v6', 'M12 7.4v.2'],
  sun: [
    'M12 8a4 4 0 100 8 4 4 0 000-8z',
    'M12 2.5v2',
    'M12 19.5v2',
    'M2.5 12h2',
    'M19.5 12h2',
    'M5.3 5.3l1.4 1.4',
    'M17.3 17.3l1.4 1.4',
    'M5.3 18.7l1.4-1.4',
    'M17.3 6.7l1.4-1.4',
  ],
  moon: ['M20 14.5A8.5 8.5 0 019.5 4a7 7 0 1010.5 10.5z'],
  auto: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 3v18', 'M12 7l5 0', 'M12 12h8', 'M12 17h5'],
  globe: [
    'M12 3a9 9 0 100 18 9 9 0 000-18z',
    'M3 12h18',
    'M12 3c2.8 3 2.8 15 0 18',
    'M12 3c-2.8 3-2.8 15 0 18',
  ],
  user: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4.5 20.5c.8-4 3.8-5.5 7.5-5.5s6.7 1.5 7.5 5.5'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M4.5 7h15', 'M9.5 7V4.5h5V7', 'M6.5 7l1 13h9l1-13', 'M10 11v6', 'M14 11v6'],
  pencil: ['M4 20l1-4.5L16.5 4l3.5 3.5L8.5 19z', 'M14 6.5l3.5 3.5'],
  back: ['M15 5l-7 7 7 7'],
  next: ['M9 5l7 7-7 7'],
  quill: ['M20 3c-8 1-13 6-14.5 14.5', 'M20 3c0 7-3.5 11-10 12.5', 'M4 21l2.5-5', 'M9 12.5h6'],
  lock: ['M6.5 11h11v9h-11z', 'M8.5 11V8a3.5 3.5 0 017 0v3'],
  play: ['M8 5l11 7-11 7z'],
  gear: [
    'M12 9a3 3 0 100 6 3 3 0 000-6z',
    'M12 2.5v3',
    'M12 18.5v3',
    'M2.5 12h3',
    'M18.5 12h3',
    'M5.3 5.3l2.1 2.1',
    'M16.6 16.6l2.1 2.1',
    'M5.3 18.7l2.1-2.1',
    'M16.6 7.4l2.1-2.1',
  ],
} as const;

export type IconName = keyof typeof PATHS;

/** `flip` mirrors the icon in RTL (for arrows that point "forward" or "back"). */
export function icon(name: IconName, flip = false): SVGElement {
  const svg = s('svg', {
    class: flip ? 'icon icon--flip' : 'icon',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  for (const d of PATHS[name]) svg.append(s('path', { d }));
  return svg;
}
