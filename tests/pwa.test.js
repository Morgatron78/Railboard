import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

test('service worker precaches existing project-relative shell and serves offline navigation', async () => {
  const handlers = {};
  const entries = new Map();
  const scope = 'https://example.test/Railboard/';
  let activations = 0;
  const cache = {
    async addAll(assets) {
      for (const asset of assets) {
        await access(new URL(asset === './' ? '../index.html' : `../${asset.slice(2)}`, import.meta.url));
        entries.set(new URL(asset, scope).href, { asset });
      }
    },
    async match(key) { return entries.get(key); }
  };
  const context = {
    URL,
    self: { location: { origin: 'https://example.test' }, registration: { scope }, skipWaiting() { activations++; return Promise.resolve(); }, clients: { claim() {} }, addEventListener(name, handler) { handlers[name] = handler; } },
    caches: { async open() { return cache; }, async keys() { return ['railboard-shell-v1', 'unrelated-cache']; }, async delete(key) { assert.ok(key.startsWith('railboard-shell-')); } },
    fetch() { throw new Error('Network offline'); }
  };
  vm.runInNewContext(await readFile(new URL('../sw.js', import.meta.url), 'utf8'), context);
  let pending;
  handlers.install({ waitUntil(value) { pending = value; } });
  await pending;
  assert.equal(activations,0);
  handlers.message({data:{type:'UNKNOWN'}});
  assert.equal(activations,0);
  handlers.message({data:{type:'ACTIVATE_UPDATE'},waitUntil(value){pending=value;}});
  await pending;
  assert.equal(activations,1);
  handlers.activate({ waitUntil(value) { pending = value; } });
  await pending;
  for (const [url, mode, asset] of [[`${scope}?demo=empty`, 'navigate', './'], [`${scope}src/app.js`, 'cors', './src/app.js']]) {
    handlers.fetch({ request: { url, mode, method: 'GET' }, respondWith(value) { pending = value; } });
    assert.equal((await pending).asset, asset);
  }
  handlers.fetch({ request: { url: `${scope}api/departures`, mode: 'cors', method: 'GET' }, respondWith() { assert.fail('API must not be intercepted'); } });
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(new URL(manifest.start_url, scope).href, scope);
  for (const icon of manifest.icons) await access(new URL(`../${icon.src.slice(2)}`, import.meta.url));
});
