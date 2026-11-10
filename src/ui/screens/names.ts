// Names shared by several screens.

import type { LayoutId } from '../../core';
import type { Track } from '../../save';
import type { I18n } from '../i18n';

export function trackName(t: I18n, track: Track): string {
  return t.t(track === 1 ? 'track.name1' : 'track.name2');
}

export function layoutName(t: I18n, layout: LayoutId): string {
  return t.t(layout === 'he' ? 'layout.nameHe' : 'layout.nameEn');
}
