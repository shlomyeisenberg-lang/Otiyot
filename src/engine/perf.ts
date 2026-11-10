// The performance overlay: frames per second, frame time, draw calls and triangles against the
// budget, and what the renderer holds. For development and for the test range; labels are passed
// in already translated.

import type { FrameStats } from './engine';
import { BUDGET } from './quality';

export interface PerfLabels {
  fps: string;
  frame: string;
  draws: string;
  triangles: string;
  memory: string;
  quality: string;
}

export class PerfOverlay {
  readonly el: HTMLElement;
  private readonly cells: HTMLElement[] = [];
  private since = 0;

  constructor(labels: PerfLabels, doc: Document = document) {
    this.el = doc.createElement('dl');
    this.el.className = 'perf';
    this.el.setAttribute('data-testid', 'perf');
    for (const label of [
      labels.fps,
      labels.frame,
      labels.draws,
      labels.triangles,
      labels.memory,
      labels.quality,
    ]) {
      const dt = doc.createElement('dt');
      dt.textContent = label;
      const dd = doc.createElement('dd');
      dd.dir = 'ltr';
      this.cells.push(dd);
      this.el.append(dt, dd);
    }
  }

  /** Call every frame; the text is refreshed four times a second. */
  update(s: FrameStats, dt: number): void {
    this.since += dt;
    if (this.since < 0.25) return;
    this.since = 0;
    const c = this.cells;
    this.put(c[0], s.fps.toFixed(0), s.fps < 50);
    this.put(c[1], `${s.frameMs.toFixed(1)} ms`, s.frameMs > 20);
    // The budgets are set for medium; high and ultra spend more on shadows by design.
    const budgeted = s.quality === 'low' || s.quality === 'medium';
    this.put(
      c[2],
      `${s.drawCalls} / ${BUDGET.drawCalls}`,
      budgeted && s.drawCalls > BUDGET.drawCalls,
    );
    this.put(
      c[3],
      `${(s.triangles / 1000).toFixed(1)}k / ${BUDGET.triangles / 1000}k`,
      s.triangles > BUDGET.triangles,
    );
    this.put(c[4], `${s.geometries} · ${s.textures} · ${s.programs}`, false);
    this.put(c[5], s.quality, false);
  }

  private put(cell: HTMLElement | undefined, text: string, over: boolean): void {
    if (!cell) return;
    if (cell.textContent !== text) cell.textContent = text;
    cell.classList.toggle('perf__over', over);
  }
}
