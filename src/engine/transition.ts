// The loading transition: an ink blot spreads from the middle of the screen until it covers
// everything, the scenes are swapped behind it, and a ragged hole opens onto the new one.
// Drawn on a small 2D canvas stretched over the screen (cheap, soft-edged, and independent of the
// 3D renderer, which is busy loading at that moment). With reduce-motion it is a plain fade.

const LOBES = 72;
const DROPS = 16;

export class InkWipe {
  readonly el: HTMLCanvasElement;
  /** Skip the blot and fade instead. */
  reducedMotion = false;

  private readonly g: CanvasRenderingContext2D | null;
  private readonly lobe = new Float32Array(LOBES);
  private readonly drops = new Float32Array(DROPS * 3);
  private raf = 0;
  private timer = 0;

  constructor(doc: Document = document) {
    this.el = doc.createElement('canvas');
    this.el.className = 'inkwipe';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.width = 480;
    this.el.height = 270;
    this.el.hidden = true;
    this.g = this.el.getContext('2d');
    // A fixed splat shape: a few long fingers among many short ones.
    let s = 12345;
    const rnd = (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < LOBES; i++) this.lobe[i] = Math.pow(rnd(), 3.2);
    for (let i = 0; i < DROPS; i++) {
      this.drops[i * 3] = rnd() * Math.PI * 2;
      this.drops[i * 3 + 1] = 1.08 + rnd() * 0.35;
      this.drops[i * 3 + 2] = 0.012 + rnd() * 0.03;
    }
  }

  /** Ink spreads until the screen is covered. */
  cover(ms = 480): Promise<void> {
    return this.run(ms, false);
  }

  /** A hole opens in the ink until it is gone. */
  reveal(ms = 620): Promise<void> {
    return this.run(ms, true);
  }

  private run(ms: number, hole: boolean): Promise<void> {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.timer);
    const el = this.el;
    const w = Math.max(1, el.clientWidth || window.innerWidth);
    const h = Math.max(1, el.clientHeight || window.innerHeight);
    el.width = 480;
    el.height = Math.max(120, Math.round((480 * h) / w));
    el.hidden = false;
    // The ink color comes from the stylesheet (a token), never from code.
    const ink = getComputedStyle(el).color;
    return new Promise((resolve) => {
      const start = performance.now();
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        cancelAnimationFrame(this.raf);
        window.clearTimeout(this.timer);
        if (hole) el.hidden = true;
        else this.draw(1, false, ink);
        el.style.opacity = '';
        resolve();
      };
      const tick = (now: number): void => {
        const p = Math.min(1, (now - start) / ms);
        if (this.reducedMotion) {
          this.draw(1, false, ink);
          el.style.opacity = String(hole ? 1 - p : p);
        } else {
          this.draw(p, hole, ink);
        }
        if (p >= 1) finish();
        else this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
      // A hidden tab stops animation frames; never leave a load waiting on them.
      this.timer = window.setTimeout(finish, ms + 400);
    });
  }

  private draw(p: number, hole: boolean, ink: string): void {
    const g = this.g;
    if (!g) return;
    const w = this.el.width;
    const h = this.el.height;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.fillStyle = ink;
    if (hole) g.fillRect(0, 0, w, h);
    else if (p >= 1) {
      g.fillRect(0, 0, w, h);
      return;
    }
    if (hole) g.globalCompositeOperation = 'destination-out';
    // Ease: fast at first, slowing as it nears the edges.
    const e = 1 - Math.pow(1 - p, 2.2);
    const max = Math.hypot(w, h) * 0.62;
    const r = e * max;
    const cx = w / 2;
    const cy = h / 2;
    const reach = (i: number): number => {
      const l = this.lobe[((i % LOBES) + LOBES) % LOBES] as number;
      // Fingers run ahead of the blot early on and are swallowed as it fills the screen.
      return r * (0.86 + 0.5 * l * (1 - e * 0.7)) + 2;
    };
    // A smooth closed outline through the lobes: curve to each midpoint, bending at each lobe.
    const px = (i: number): number => cx + Math.cos((i / LOBES) * Math.PI * 2) * reach(i);
    const py = (i: number): number => cy + Math.sin((i / LOBES) * Math.PI * 2) * reach(i);
    g.beginPath();
    g.moveTo((px(-1) + px(0)) / 2, (py(-1) + py(0)) / 2);
    for (let i = 0; i < LOBES; i++) {
      g.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
    }
    g.closePath();
    g.fill();
    // Droplets thrown ahead of the edge.
    for (let i = 0; i < DROPS; i++) {
      const a = this.drops[i * 3] as number;
      const d = (this.drops[i * 3 + 1] as number) * r;
      const s = (this.drops[i * 3 + 2] as number) * max * (0.4 + e);
      g.beginPath();
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.timer);
    this.el.remove();
  }
}
