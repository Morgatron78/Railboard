import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockBoard, mockProvider, searchStations, statusText } from '../src/api.js';
import { validateSettings, matchingCache } from '../src/storage.js';
test('boards cover disruption states and service detail matches selected service', async () => {
  const board = createMockBoard({ count: 10, now: new Date('2026-09-09T23:58:00Z') });
  assert.equal(board.services.length, 10);
  for (const status of ['on-time', 'delayed', 'cancelled', 'unknown']) assert.ok(board.services.some(s => s.status === status));
  assert.ok(board.services.some(s => s.platformChanged));
  assert.ok(board.services.some(s => s.transport === 'bus'));
  assert.ok(board.services.some(s => s.platform === null));
  for (const service of board.services) {
    assert.equal(await mockProvider.getServiceDetails(service), service);
    assert.equal(service.callingPoints[0].name, board.station.name);
    assert.equal(service.callingPoints.at(-1).name, service.destination);
    assert.match(service.scheduled, /^\d{2}:\d{2}$/);
    assert.ok(statusText(service));
  }
});
test('arrivals end at selected station, including stations that appear in demo routes', () => {
  for (const crs of ['BMV', 'FOU', 'BHM']) {
    const board = createMockBoard({ crs, type: 'arrivals' });
    assert.ok(board.services.every(s => s.destination === board.station.name && s.callingPoints.at(-1).name === board.station.name));
  }
});
test('search, empty and failure scenarios', () => {
  assert.equal(searchStations('bmv')[0].name, 'Bromsgrove');
  assert.equal(searchStations('  broms ')[0].crs, 'BMV');
  assert.equal(searchStations('not a station').length, 0);
  assert.equal(createMockBoard({ scenario: 'empty' }).services.length, 0);
  assert.throws(() => createMockBoard({ scenario: 'error' }));
  assert.throws(() => createMockBoard({ crs: 'XXX' }));
});
test('stored preferences are validated and caches cannot cross stations or board types', () => {
  const settings = validateSettings({ crs: 'XXX', theme: 'bad', count: 100, autoRefresh: 'false' });
  assert.equal(settings.crs, 'BMV');
  assert.equal(settings.count, 6);
  assert.equal(settings.autoRefresh, true);
  assert.equal(validateSettings(null).theme, 'retro');
  const board = createMockBoard();
  assert.ok(matchingCache(board, settings, 'departures'));
  assert.ok(!matchingCache(board, settings, 'arrivals'));
  assert.ok(!matchingCache(board, { ...settings, crs: 'FOU' }, 'departures'));
});
