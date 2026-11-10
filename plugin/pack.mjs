// Zips dist/ plus plugin/manifest.json into dist-plugin/otiyot-<version>.otzplugin
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const manifest = JSON.parse(readFileSync(join(root, 'plugin/manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
manifest.version = pkg.version;

const files = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files[relative(dist, p).split(sep).join('/')] = readFileSync(p);
  }
})(dist);
files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

const out = join(root, 'dist-plugin');
mkdirSync(out, { recursive: true });
const file = join(out, `otiyot-${manifest.version}.otzplugin`);
writeFileSync(file, zipSync(files, { level: 9 }));
console.log(`Wrote ${file} (${Object.keys(files).length} files)`);
