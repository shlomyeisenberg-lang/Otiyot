import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('plugin manifest', () => {
  const m = JSON.parse(readFileSync('plugin/manifest.json', 'utf8'));
  it('has the agreed id and entrypoint', () => {
    expect(m.id).toBe('il.otzaria.otiyot');
    expect(m.entrypoint).toBe('index.html');
    expect(m.type).toBe('webapp');
  });
});
