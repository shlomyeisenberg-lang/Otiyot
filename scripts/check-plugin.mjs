// Checks the built plugin (dist-plugin/otiyot-<version>.otzplugin) the way Otzaria opens it:
// from a local folder, with file-style relative paths and no network.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const file = join(root, 'dist-plugin', `otiyot-${pkg.version}.otzplugin`);
const errors = [];
if (!existsSync(file)) {
  console.error(`Missing ${file}. Run "pnpm build:plugin" first.`);
  process.exit(1);
}
const files = unzipSync(new Uint8Array(readFileSync(file)));
const names = Object.keys(files);
const text = (n) => strFromU8(files[n]);

if (!files['manifest.json']) errors.push('manifest.json is missing');
if (!files['index.html']) errors.push('index.html is missing');
if (files['manifest.json']) {
  const m = JSON.parse(text('manifest.json'));
  if (m.version !== pkg.version) errors.push(`manifest version ${m.version} is not ${pkg.version}`);
  if (m.entrypoint !== 'index.html') errors.push('entrypoint must be index.html');
  if (!files[m.entrypoint]) errors.push('entrypoint file is not in the archive');
}

// Every reference in index.html must be a relative path that exists in the archive.
const html = files['index.html'] ? text('index.html') : '';
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
for (const r of refs) {
  if (/^(https?:)?\/\//.test(r)) errors.push(`index.html reaches the network: ${r}`);
  else if (r.startsWith('/')) errors.push(`index.html uses a root-absolute path: ${r}`);
  else if (!r.startsWith('data:') && !files[r.replace(/^\.\//, '').split(/[?#]/)[0]])
    errors.push(`index.html points at a file that is not shipped: ${r}`);
}

// CSS url(...) must be relative too; scripts must not fetch anything over the network.
for (const n of names.filter((x) => x.endsWith('.css'))) {
  for (const m of text(n).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const u = m[1];
    if (/^(https?:)?\/\//.test(u)) errors.push(`${n} loads ${u}`);
    else if (u.startsWith('/')) errors.push(`${n} uses a root-absolute url ${u}`);
  }
}
for (const n of names.filter((x) => x.endsWith('.js') && !x.includes('/vendor/'))) {
  const js = text(n);
  if (/\bfetch\(\s*["'`]https?:/.test(js)) errors.push(`${n} calls fetch on an http(s) address`);
  if (/new\s+WebSocket\(/.test(js)) errors.push(`${n} opens a WebSocket`);
}

if (errors.length) {
  console.error('Plugin check failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`Plugin check passed: ${names.length} files, relative paths only, no network (${file}).`);
