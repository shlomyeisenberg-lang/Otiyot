import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string): string => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('release 1.0', () => {
  const pkg = JSON.parse(read('package.json')) as { version: string };
  const manifest = JSON.parse(read('plugin/manifest.json')) as {
    version: string;
    stability: string;
    entrypoint: string;
  };

  it('is version 1.0.0 in the package and the plugin manifest', () => {
    expect(pkg.version).toBe('1.0.0');
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.stability).toBe('stable');
    expect(manifest.entrypoint).toBe('index.html');
  });

  it('has a release workflow that builds the plugin on a version tag', () => {
    const wf = read('.github/workflows/release.yml');
    expect(wf).toContain("tags: ['v*']");
    expect(wf).toContain('pnpm build:plugin');
    expect(wf).toContain('gh release');
  });

  it('documents install and rollback, and the changelog names 1.0.0', () => {
    const launch = read('docs/LAUNCH.md');
    expect(launch).toMatch(/Install in Otzaria/);
    expect(launch).toMatch(/Roll back/);
    expect(read('CHANGELOG.md')).toMatch(/## 1\.0\.0/);
  });
});
