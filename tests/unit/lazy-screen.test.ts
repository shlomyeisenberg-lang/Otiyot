import { describe, expect, it, vi } from 'vitest';
import type { AppContext, Screen } from '../../src/ui/app';
import { lazyScreen } from '../../src/ui/lazyScreen';

interface FakeEl {
  style: Record<string, string>;
  children: unknown[];
  append(c: unknown): void;
}
const fakeEl = (): FakeEl => ({
  style: {},
  children: [],
  append(c) {
    this.children.push(c);
  },
});
vi.stubGlobal('document', { createElement: fakeEl });
const ctx = {} as AppContext;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function real(log: string[]): Screen {
  return {
    el: { id: 'real' } as unknown as HTMLElement,
    onKey: () => true,
    onEscape: () => true,
    focus: () => log.push('focus'),
    dispose: () => log.push('dispose'),
  };
}

describe('lazyScreen', () => {
  it('hands the shell a screen at once, with the traits it needs', () => {
    const s = lazyScreen(() => new Promise(() => undefined), { full: true, ownsMusic: true })(ctx);
    expect(s.full).toBe(true);
    expect(s.ownsMusic).toBe(true);
    expect(s.onKey?.({} as KeyboardEvent)).toBe(false);
  });

  it('builds the real screen inside the holder once the code arrives and passes calls on', async () => {
    const log: string[] = [];
    const s = lazyScreen(async () => () => real(log))(ctx);
    s.focus?.();
    await tick();
    expect((s.el as unknown as FakeEl).children).toHaveLength(1);
    expect(log).toEqual(['focus']);
    expect(s.onKey?.({} as KeyboardEvent)).toBe(true);
    s.dispose?.();
    expect(log).toEqual(['focus', 'dispose']);
  });

  it('builds nothing when the player has already left', async () => {
    const log: string[] = [];
    const s = lazyScreen(async () => () => real(log))(ctx);
    s.dispose?.();
    await tick();
    expect((s.el as unknown as FakeEl).children).toHaveLength(0);
    expect(log).toEqual([]);
  });
});
