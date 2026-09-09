import { mockProvider as api, statusText } from './api.js';
import { read, write, clearBoard, validateSettings, matchingCache } from './storage.js';
const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let settings = validateSettings(read('settings'));
let boardType = settings.board;
let board = null;
let request = 0;
let loading = false;
const scenario = new URLSearchParams(location.search).get('demo') || 'normal';
const time = value => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(value));
function updateClock() {
  const now = new Date();
  $('today').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' }).format(now);
  $('station-clock').textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London' }).format(now);
  $('station-clock').dateTime = now.toISOString();
}
setInterval(() => { if (!document.hidden) updateClock(); }, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClock(); });
function applySettings() {
  document.body.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]').content = { retro: '#121512', modern: '#f3f4ef', midnight: '#0c131d' }[settings.theme];
  $('station-name').textContent = settings.stationName;
  $('station-code').textContent = settings.crs;
  updateClock();
  $('refresh-status').textContent = settings.autoRefresh ? 'Refreshes every 30s' : 'Manual refresh';
  for (const type of ['departures', 'arrivals']) $(type).setAttribute('aria-pressed', String(type === boardType));
  $('destination-label').textContent = `${boardType === 'arrivals' ? 'Origin' : 'Destination'} / Status`;
}
function renderBoard(stale = false) {
  $('services').innerHTML = board.services.length ? board.services.map((service, index) => {
    const name = boardType === 'arrivals' ? service.origin : service.destination;
    return `<button class="service" data-index="${index}"><span class="time">${escape(service.scheduled)}</span><span><span class="destination">${escape(name)}${settings.favourite && name.toLowerCase() === settings.favourite.toLowerCase() ? ' ★' : ''}</span><span class="service-info"><span class="status ${escape(service.status)}">${escape(statusText(service))}</span>${service.transport === 'bus' ? '<span>· Replacement bus</span>' : ''}${service.platformChanged ? '<span>· Platform changed</span>' : ''}</span></span><span class="platform ${service.platformChanged ? 'changed' : ''}" aria-label="${service.transport === 'bus' ? 'Bus' : `Platform ${escape(service.platform || 'unassigned')}`}">${service.transport === 'bus' ? 'B' : escape(service.platform || '—')}</span></button>`;
  }).join('') : `<div class="empty">No ${boardType} to show.<br>Try refreshing the board shortly.</div>`;
  $('update-status').textContent = stale ? `Cached demo · ${new Date(board.generatedAt).toLocaleDateString('en-GB')} ${time(board.generatedAt)} · ${navigator.onLine ? 'Update failed' : 'Offline'}` : `Updated ${time(board.generatedAt)} · Demo`;
}
async function refresh() {
  const current = ++request;
  loading = true;
  $('refresh').disabled = true;
  $('services').setAttribute('aria-busy', 'true');
  try {
    if (!navigator.onLine) throw new Error('Offline');
    const result = await api[boardType === 'departures' ? 'getDepartures' : 'getArrivals']({ crs: settings.crs, count: settings.count, scenario });
    if (current !== request) return;
    board = result;
    if (settings.cacheBoard) write('board', board);
    renderBoard();
  } catch {
    if (current !== request) return;
    const cached = settings.cacheBoard ? read('board') : null;
    if (!board && matchingCache(cached, settings, boardType)) board = cached;
    if (board) renderBoard(true);
    else {
      $('services').innerHTML = '<div class="empty">Your board is unavailable.<br>Check your connection and try Refresh.</div>';
      $('update-status').textContent = navigator.onLine ? 'Could not update · Demo' : 'Offline · No saved board';
    }
  } finally {
    if (current === request) { loading = false; $('refresh').disabled = false; $('services').setAttribute('aria-busy', 'false'); }
  }
}
function stationOptions(query = '', selected = settings.crs) {
  const matches = api.searchStations(query);
  $('station-select').innerHTML = matches.map(s => `<option value="${s.crs}">${escape(s.name)} — ${s.crs}</option>`).join('');
  if (matches.some(s => s.crs === selected)) $('station-select').value = selected;
  if (!matches.length) $('station-select').innerHTML = '<option value="">No matching demo stations</option>';
}
function openPreferences() {
  const first = !settings.onboarded;
  $('preferences-title').textContent = first ? 'Welcome to Railboard' : 'Settings';
  $('advanced-settings').hidden = first;
  $('close-preferences').hidden = first;
  $('welcome-copy').hidden = !first;
  $('save-preferences').textContent = first ? 'Show board' : 'Save settings';
  $('station-search').value = '';
  stationOptions();
  document.querySelector(`input[name="theme"][value="${settings.theme}"]`).checked = true;
  $('default-board').value = settings.board;
  $('service-count').value = settings.count;
  $('favourite').value = settings.favourite;
  $('auto-refresh').checked = settings.autoRefresh;
  $('cache-board').checked = settings.cacheBoard;
  $('preferences').showModal();
}
$('station-search').addEventListener('input', event => stationOptions(event.target.value, $('station-select').value));
$('preferences-form').addEventListener('submit', event => {
  event.preventDefault();
  settings = validateSettings({ crs: $('station-select').value, theme: new FormData(event.target).get('theme'), board: $('default-board').value, count: Number($('service-count').value), favourite: $('favourite').value.trim(), autoRefresh: $('auto-refresh').checked, cacheBoard: $('cache-board').checked, onboarded: true });
  const saved = write('settings', settings);
  if (!settings.cacheBoard) clearBoard();
  boardType = settings.board;
  board = null;
  $('preferences').close();
  applySettings();
  refresh().then(() => { if (!saved) $('update-status').textContent += ' · Preferences could not be saved on this device'; });
});
$('preferences').addEventListener('cancel', event => { if (!settings.onboarded) event.preventDefault(); });
$('settings-button').addEventListener('click', openPreferences);
$('close-preferences').addEventListener('click', () => $('preferences').close());
$('close-journey').addEventListener('click', () => $('journey').close());
$('refresh').addEventListener('click', refresh);
for (const type of ['departures', 'arrivals']) $(type).addEventListener('click', () => { if (type === boardType) return; boardType = type; board = null; applySettings(); refresh(); });
$('services').addEventListener('click', async event => {
  const button = event.target.closest('[data-index]');
  if (!button || !board) return;
  const service = await api.getServiceDetails(board.services[Number(button.dataset.index)]);
  const fields = { From: service.origin, To: service.destination, Scheduled: service.scheduled, Expected: service.status === 'cancelled' ? 'Cancelled' : service.expected || 'Unconfirmed', Platform: service.transport === 'bus' ? 'Replacement bus' : `${service.platform || 'Unassigned'}${service.platformChanged ? ' (changed)' : ''}`, Operator: service.operator };
  $('journey-content').innerHTML = `<h2 id="journey-title">${escape(service.scheduled)} to ${escape(service.destination)}</h2><p class="status ${escape(service.status)}">${escape(statusText(service))}</p><dl class="detail-meta">${Object.entries(fields).map(([key, value]) => `<div><dt>${key}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>${service.reason ? `<p class="reason">${escape(service.reason)}</p>` : ''}<h3>Calling points</h3><ol class="timeline">${service.callingPoints.map(point => `<li><span>${escape(point.scheduled)}</span><span>${escape(point.name)}${point.expected && point.expected !== point.scheduled ? `<small>Expected ${escape(point.expected)}</small>` : service.status === 'cancelled' ? '<small>Cancelled</small>' : ''}</span></li>`).join('')}</ol><p class="hint">Illustrative route and times · Not for travel</p>`;
  $('journey').showModal();
});
setInterval(() => { if (settings.autoRefresh && !document.hidden && !loading) refresh(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && settings.autoRefresh && (!board || Date.now() - Date.parse(board.generatedAt) >= 30000)) refresh(); });
window.addEventListener('online', refresh);
window.addEventListener('offline', () => { if (board) renderBoard(true); });
applySettings();
refresh();
if (!settings.onboarded) openPreferences();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { $('refresh-status').textContent = 'Offline shell unavailable'; });
