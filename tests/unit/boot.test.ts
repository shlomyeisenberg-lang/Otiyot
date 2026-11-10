import { describe, expect, it } from 'vitest';
import { isOtzaria } from '../../src/boot';

describe('isOtzaria', () => {
  it('is false on the plain web', () => {
    expect(isOtzaria({})).toBe(false);
  });
  it('is true when the host global exists', () => {
    expect(isOtzaria({ Otzaria: {} })).toBe(true);
  });
});
