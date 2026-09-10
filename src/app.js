import { statusText } from './api.js';
import { api } from './provider.js';
import { paintLED, led } from './led.js';
import { read, write, clearBoard, validateSettings, matchingCache } from './storage.js';
const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let settings = validateSettings(read('settings'));
let boardType = settings.board;
let board = null;
let request = 0;
let loading = false;
let staleBoard = true;
const cacheKey = () => `board:${api.mock ? 'mock' : 'railinfo'}:${settings.crs}:${boardType}`;
const scenario = new URLSearchParams(location.search).get('demo') || 'normal';
const time = value => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(value));
function updateClock() {
  const now = new Date();
  $('today').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Europe/London' }).format(now);
  $('station-clock').textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London' }).format(now);
  $('station-clock').dateTime = now.toISOString();
}
setInterval(() => { if (!document.hidden) updateClock(); }, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClock(); });
function applySettings() {

  $('attribution').innerHTML = api.mock ? 'Demo services · Not for travel' : 'Data via railinfo<span class="attribution-break"> · </span>Network Rail &amp; National Rail feeds';
  document.querySelector('#journey .eyebrow').textContent = api.mock ? 'Service details · Demo' : 'Service details';
  document.body.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]').content = { retro: '#f2f0e8', modern: '#f2f0e8', midnight: '#f2f0e8' }[settings.theme];
  $('station-name').textContent = settings.stationName;
  $('station-code').textContent = settings.crs;
  updateClock();
  if (!board) $('board-state').replaceChildren();


  for (const type of ['departures', 'arrivals']) $(type).setAttribute('aria-pressed', String(type === boardType));
  $('destination-label').textContent = `${boardType === 'arrivals' ? 'Origin' : 'Destination'} / Status`;
}
function renderFooterState(label) {
  const el = $('board-state');
  el.dataset.state = label.toLowerCase();
  el.innerHTML = settings.theme === 'retro'
    ? `<span class="sr-only">${label}</span><span class="led-text" aria-hidden="true">${led(label)}</span>`
    : escape(label);
}
function renderBoard(stale = false) {
  staleBoard = stale;
  $('services').innerHTML = board.services.length ? board.services.map((service, index) => {
    const name = boardType === 'arrivals' ? service.origin : service.destination;
    return `<button class="service" data-index="${index}"><span class="time">${escape(service.scheduled)}</span><span><span class="destination-line"><span class="destination">${escape(name)}</span>${settings.favourite && name.toLowerCase() === settings.favourite.toLowerCase() ? '<span class="favourite-marker" aria-label="Favourite destination">☆</span>' : ''}</span><span class="service-info">${service.day > 0 ? `<span>+${service.day} day</span>` : ""}<span class="status ${escape(service.status)}">${escape(statusText(service))}</span>${service.transport === 'bus' ? '<span>· Replacement bus</span>' : ''}${service.platformChanged ? '<span>· Platform changed</span>' : ''}</span></span><span class="platform ${service.platformChanged ? 'changed' : ''}" aria-label="${service.transport === 'bus' ? 'Bus' : `Platform ${escape(service.platform || 'unassigned')}`}">${service.transport === 'bus' ? 'B' : escape(service.platform || '—')}</span></button>`;
  }).join('') : `<div class="empty">No ${boardType} to show.<br>Try refreshing the board shortly.</div>`;
  const old = stale || Date.now() - Date.parse(board.generatedAt) > 90000;
  renderFooterState(old ? 'Cached' : api.mock ? 'Demo' : 'Live');
  $('update-status').textContent = old ? `Cached ${api.mock ? 'demo' : 'board'} · ${new Date(board.generatedAt).toLocaleDateString('en-GB')} ${time(board.generatedAt)} · ${!navigator.onLine ? 'Offline' : stale ? 'Update failed' : 'Data may be out of date'}` : `Updated ${time(board.generatedAt)}${api.mock ? ' · Demo' : ''}`;
  $('board-messages').textContent = (board.messages || []).join(' ');
  $('board-messages').hidden = !board.messages?.length;
  if(settings.theme === 'retro') paintLED($('services'));
}
async function openBoard() {
  const cached = settings.cacheBoard ? read(cacheKey()) : null;
  if(matchingCache(cached,settings,boardType,api.mock)) { board=cached; renderBoard(true); }
  else {
    $('services').innerHTML='<div class="empty">Please wait. Updating information...</div>';
    if(settings.theme==='retro') paintLED($('services'));
  }
  return refresh();
}
async function refresh() {
  if(loading) return;
  const current = ++request;
  loading = true;
  $('refresh').disabled = true;
  $('services').setAttribute('aria-busy', 'true');
  try {
    if (!navigator.onLine) throw new Error('Offline');
    const result = await api[boardType === 'departures' ? 'getDepartures' : 'getArrivals']({ crs: settings.crs, count: settings.count, scenario });
    if (current !== request) return;
    board = result;
    if (settings.cacheBoard) write(cacheKey(), board);
    renderBoard();
  } catch {
    if (current !== request) return;
    const cached = settings.cacheBoard ? read(cacheKey()) : null;
    if (!board && matchingCache(cached, settings, boardType, api.mock)) board = cached;
    if (board) renderBoard(true);
    else {
      $('services').innerHTML = '<div class="empty">Your board is unavailable.<br>Check your connection and try Refresh.</div>';
      $('board-messages').hidden = true;
      renderFooterState('Unavailable');
      $('update-status').textContent = navigator.onLine ? `Could not update${api.mock ? ' · Demo' : ''}` : 'Offline · No saved board';
      if(settings.theme === 'retro') paintLED($('services'));
    }
  } finally {
    if (current === request) { loading = false; $('refresh').disabled = false; $('services').setAttribute('aria-busy', 'false'); }
  }
}
let searchId = 0;
async function stationOptions(query = '', selected = settings.crs) {
  const id = ++searchId;
  let matches;
  try { matches = query.trim() ? await api.searchStations(query) : [{crs:settings.crs,name:settings.stationName}]; }
  catch { if(id===searchId) $('station-help').textContent='Station search unavailable. Try again.'; return; }
  if(id !== searchId) return;
  $('station-help').textContent = matches.length ? 'Select a station by name or CRS code.' : 'No matching stations.';
  $('station-select').innerHTML = matches.map(s => `<option value="${s.crs}">${escape(s.name)} — ${s.crs}</option>`).join('');
  if (matches.some(s => s.crs === selected)) $('station-select').value = selected;
  if (!matches.length) $('station-select').innerHTML = '<option value="">No matching stations</option>';
  for (const option of $('station-select').options) option.dataset.name = matches.find(s=>s.crs===option.value)?.name || '';
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
let searchTimer;
$('station-search').addEventListener('input', event => { clearTimeout(searchTimer); ++searchId; const q=event.target.value; searchTimer=setTimeout(()=>stationOptions(q,$('station-select').value),300); });
$('preferences-form').addEventListener('submit', event => {
  event.preventDefault();
  const previous = settings;
  settings = validateSettings({ crs: $('station-select').value, stationName: $('station-select').selectedOptions[0]?.dataset.name, theme: new FormData(event.target).get('theme'), board: $('default-board').value, count: Number($('service-count').value), favourite: $('favourite').value.trim(), autoRefresh: $('auto-refresh').checked, cacheBoard: $('cache-board').checked, onboarded: true });
  const saved = write('settings', settings);
  if (!settings.cacheBoard) clearBoard();
  const changed = previous.crs !== settings.crs || previous.count !== settings.count || previous.board !== settings.board;
  if(changed) { boardType = settings.board; board = null; ++request; loading=false; }
  $('preferences').close();
  applySettings();
  (changed ? openBoard() : Promise.resolve(board && renderBoard(staleBoard))).then(() => { if (!saved) $('update-status').textContent += ' · Preferences could not be saved on this device'; });
});
$('preferences').addEventListener('cancel', event => { if (!settings.onboarded) event.preventDefault(); });
$('settings-button').addEventListener('click', openPreferences);
$('close-preferences').addEventListener('click', () => $('preferences').close());
$('close-journey').addEventListener('click', () => $('journey').close());
$('refresh').addEventListener('click', refresh);
for (const type of ['departures', 'arrivals']) $(type).addEventListener('click', () => { if (type === boardType) return; boardType = type; board = null; ++request; loading=false; applySettings(); openBoard(); });
$('services').addEventListener('click', async event => {
  const button = event.target.closest('[data-index]');
  if (!button || !board) return;
  const service = board.services[Number(button.dataset.index)];
  const fields = { From: service.origin, To: service.destination, Scheduled: service.scheduled, Expected: service.status === 'cancelled' ? 'Cancelled' : service.expected || 'Unconfirmed', Platform: service.transport === 'bus' ? 'Replacement bus' : `${service.platform || 'Unassigned'}${service.platformChanged ? ' (changed)' : ''}`, Operator: service.operator };
  const groups = service.callingGroups?.length ? service.callingGroups : [{ points: service.callingPoints }];
  const timeline = groups.map(group => `${groups.length > 1 ? `<h4>${escape(group.label)}</h4>` : ''}<ol class="timeline">${group.points.map(point => `<li><span>${escape(point.scheduled)}</span><span>${escape(point.name)}${point.status === 'cancelled' || service.status === 'cancelled' ? '<small>Cancelled</small>' : point.actual ? `<small>Actual ${escape(point.actual)}</small>` : point.expected && point.expected !== point.scheduled ? `<small>Expected ${escape(point.expected)}</small>` : ''}</span></li>`).join('')}</ol>`).join('');
  $('journey-content').innerHTML = `<h2 id="journey-title">${escape(service.scheduled)} to ${escape(service.destination)}</h2><p class="status ${escape(service.status)}">${escape(statusText(service))}</p><dl class="detail-meta">${Object.entries(fields).map(([key, value]) => `<div><dt>${key}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>${service.reason ? `<p class="reason">${escape(service.reason)}</p>` : ''}<h3>Calling points</h3>${groups.some(g => g.points.length) ? timeline : '<div id="live-calling-points" role="status">Loading calling points…</div>'}<p class="hint">${api.mock ? 'Illustrative route and times · Not for travel' : `Board received ${time(board.generatedAt)}`}</p>`;
  $('journey').showModal();
  const target = $('live-calling-points');
  if(target && !api.mock) {
    try {
      const points = await api.getServiceDetails({crs:board.station.crs, service});
      if(!target.isConnected || !$('journey').open) return;
      target.innerHTML = points.length ? `<ol class="timeline">${points.map(p => `<li class="${p.here ? 'current-call' : p.passed ? 'passed-call' : ''}"><span>${escape(p.scheduled)}</span><span>${escape(p.name)}${p.here ? '<small>Selected station</small>' : ''}${p.status === 'cancelled' ? '<small>Cancelled</small>' : p.expected && p.expected !== p.scheduled ? `<small>Expected ${escape(p.expected)}</small>` : ''}${p.passed ? '<small>Passed</small>' : ''}</span></li>`).join('')}</ol>` : 'No calling points available for this service.';
    } catch {
      if(target.isConnected) target.textContent = 'Calling points temporarily unavailable. Close and reopen this service to try again.';
    }
  }
});
setInterval(() => { if (settings.autoRefresh && !document.hidden && !loading) refresh(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && settings.autoRefresh && (!board || Date.now() - Date.parse(board.generatedAt) >= 30000)) refresh(); });
window.addEventListener('online', refresh);
window.addEventListener('offline', () => { if (board) renderBoard(true); });
applySettings();
openBoard();
if (!settings.onboarded) openPreferences();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { $('refresh-status').hidden = false; $('refresh-status').textContent = 'Offline shell unavailable'; });
