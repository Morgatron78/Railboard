import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUILD, LOG_LIMIT, RailboardError, banner, buildReport, createDiagnostics, runChecks, verdictFor, sanitiseState } from '../src/diagnostics.js';
import { createLiveProvider } from '../src/provider.js';

const memory = () => { let saved = null; return { load: () => saved, save: v => { saved = JSON.parse(JSON.stringify(v)); }, peek: () => saved }; };

test('build number matches the service worker cache and the About text', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(sw, new RegExp(`railboard-shell-v${BUILD}'`));
  assert.match(html, new RegExp(`>Build ${BUILD}<`));
  assert.match(sw, /\.\/src\/diagnostics\.js/);
});

test('failure log keeps the newest entries only, newest first, and persists', () => {
  const store = memory(); let tick = 0;
  const d = createDiagnostics({ ...store, now: () => new Date(Date.UTC(2026, 9, 21, 12, 0, tick++)) });
  for (let i = 0; i < LOG_LIMIT + 5; i++) d.failure(new RailboardError('UPSTREAM_SHAPE', 'x', { ref: `RB-${i}`, detail: 'Missing field: departures' }));
  assert.equal(d.entries.length, LOG_LIMIT);
  assert.equal(d.entries[0].ref, `RB-${LOG_LIMIT + 4}`);
  assert.equal(store.peek().log.length, LOG_LIMIT);
  d.success(); assert.ok(d.lastSuccess);
  const again = createDiagnostics(store);
  assert.equal(again.entries.length, LOG_LIMIT); assert.equal(again.lastSuccess, d.lastSuccess);
  again.clear(); assert.equal(createDiagnostics(store).entries.length, 0);
  assert.ok(createDiagnostics(store).lastSuccess, 'clearing problems keeps the last success');
});

test('stored diagnostics are sanitised on load', () => {
  const clean = sanitiseState({ log: [null, { at: 'nope', code: 'X' }, { at: '2026-10-21T12:00:00Z', code: 'A'.repeat(100), ref: 5, detail: 'd'.repeat(500), status: 'x' }], lastSuccess: 'bad' });
  assert.equal(clean.log.length, 1); assert.equal(clean.log[0].code.length, 40); assert.equal(clean.log[0].ref, ''); assert.equal(clean.log[0].detail.length, 160); assert.equal(clean.log[0].status, null);
  assert.equal(clean.lastSuccess, null);
  assert.deepEqual(sanitiseState('garbage'), { log: [], lastSuccess: null });
});

test('verdicts name the failing layer', () => {
  const link = (id, state, code) => ({ id, state, code });
  assert.equal(verdictFor([link('app', 'ok'), link('proxy', 'ok'), link('feed', 'ok')]).tone, 'ok');
  assert.match(verdictFor([link('app', 'ok'), link('proxy', 'bad', 'PROXY_TIMEOUT'), link('feed', 'idle')]).title, /proxy/);
  assert.match(verdictFor([link('app', 'ok'), link('proxy', 'ok'), link('feed', 'bad', 'UPSTREAM_SHAPE')]).title, /changed/);
  assert.equal(verdictFor([], false).tone, 'idle');
});

test('banner uses the saved time and the reference only when present', () => {
  const b = banner(new RailboardError('UPSTREAM_SHAPE', 'x', { ref: 'RB-7F3K' }), '13:58');
  assert.equal(b.ref, 'RB-7F3K'); assert.match(b.text, /13:58/);
  assert.match(banner(new RailboardError('OFFLINE', 'x'), null).text, /No saved board/);
});

test('health checks report each layer from one deep request', async () => {
  const ok = await runChecks({ base: 'https://p.test', fetcher: async url => { assert.equal(url, 'https://p.test/health?deep=1'); return Response.json({ status: 'ok', version: '1.2.0', upstream: { ok: true, ms: 200 } }); } });
  assert.deepEqual(ok.links.map(l => l.state), ['ok', 'ok', 'ok']); assert.equal(ok.workerVersion, '1.2.0'); assert.equal(ok.verdict.tone, 'ok');
  const shape = await runChecks({ base: 'https://p.test', fetcher: async () => Response.json({ status: 'degraded', version: '1.2.0', upstream: { ok: false, code: 'UPSTREAM_SHAPE', ms: 90 } }) });
  assert.equal(shape.links[1].state, 'ok'); assert.equal(shape.links[2].code, 'UPSTREAM_SHAPE'); assert.match(shape.verdict.title, /changed/);
  const down = await runChecks({ base: 'https://p.test', fetcher: async () => { throw new DOMException('slow', 'TimeoutError'); } });
  assert.equal(down.links[1].code, 'PROXY_TIMEOUT'); assert.equal(down.links[2].state, 'idle');
  const http = await runChecks({ base: 'https://p.test', fetcher: async () => new Response('', { status: 530 }) });
  assert.equal(http.links[1].code, 'PROXY_STATUS');
  const offline = await runChecks({ base: 'https://p.test', online: false, fetcher: () => assert.fail('offline must not fetch') });
  assert.equal(offline.verdict.tone, 'idle');
});

test('report is plain text with checks and problems', () => {
  const text = buildReport({ now: new Date('2026-10-21T13:02:17Z'), entries: [{ at: '2026-10-21T13:02:07Z', code: 'UPSTREAM_SHAPE', ref: 'RB-7F3K', status: null, detail: 'Missing field: departures' }], lastSuccess: '2026-10-21T12:58:40Z', context: { theme: 'retro', crs: 'BMV', board: 'departures', online: true, shell: 'v45 (active)', boardState: 'saved 13:58' } });
  for (const part of [`Build ${BUILD}`, 'UPSTREAM_SHAPE', 'RB-7F3K', 'Missing field: departures', 'Checks', 'not run', 'BMV']) assert.ok(text.includes(part), part);
  assert.ok(!/@|token|password/i.test(text));
});

test('provider failures carry code, reference and status', async () => {
  const failing = res => createLiveProvider('https://p.test', async () => typeof res === 'function' ? res() : res);
  const get = p => p.getDepartures({ crs: 'BMV', count: 6 }).then(() => assert.fail('should reject'), e => e);
  let e = await get(failing(Response.json({ error: 'Invalid upstream response', code: 'UPSTREAM_SHAPE', ref: 'RB-7F3K', detail: 'expected departures' }, { status: 502 })));
  assert.ok(e instanceof RailboardError); assert.equal(e.code, 'UPSTREAM_SHAPE'); assert.equal(e.ref, 'RB-7F3K'); assert.equal(e.status, 502);
  e = await get(failing(new Response('<html>', { status: 502, headers: { 'X-Railboard-Request-Id': 'RB-AAAA' } })));
  assert.equal(e.code, 'PROXY_STATUS'); assert.equal(e.ref, 'RB-AAAA');
  e = await get(failing(() => { throw new TypeError('Failed to fetch'); }));
  assert.equal(e.code, 'PROXY_UNREACHABLE');
  e = await get(failing(() => { throw new DOMException('t', 'TimeoutError'); }));
  assert.equal(e.code, 'PROXY_TIMEOUT');
  e = await get(failing(new Response('not json', { status: 200 })));
  assert.equal(e.code, 'PROXY_BAD_RESPONSE');
  e = await get(failing(Response.json({ departures: [] })));
  assert.equal(e.code, 'APP_SHAPE');
  const limited = failing(new Response('', { status: 429, headers: { 'Retry-After': '60' } }));
  assert.equal((await get(limited)).code, 'RATE_LIMITED');
  assert.equal((await get(limited)).code, 'COOLDOWN');
});
