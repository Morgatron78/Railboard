import { statusText } from './api.js';
import { favouriteStop, journeyProgress, detailStatus } from './detail.js';
import { createFollower } from './tracking.js';
import { watchUpdates } from './updates.js';
import { createTrainMap, expandableMap } from './map.js';
import { api } from './provider.js';
import { paintLED, led } from './led.js';
import { read, write, clearBoard, validateSettings, matchingCache, recentStations } from './storage.js';
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
  document.querySelector('.note').hidden = !api.mock;

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
function setUpdateStatus(text) {
  $('update-status').innerHTML = settings.theme === 'retro'
    ? `<span class="sr-only">${escape(text)}</span><span class="led-text" aria-hidden="true">${led(text)}</span>`
    : escape(text);
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
  setUpdateStatus(old ? `Cached ${api.mock ? 'demo' : 'board'} · ${new Date(board.generatedAt).toLocaleDateString('en-GB')} ${time(board.generatedAt)} · ${!navigator.onLine ? 'Offline' : stale ? 'Update failed' : 'Data may be out of date'}` : `Updated ${time(board.generatedAt)}${api.mock ? ' · Demo' : ''}`);
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
      setUpdateStatus(navigator.onLine ? `Could not update${api.mock ? ' · Demo' : ''}` : 'Offline · No saved board');
      if(settings.theme === 'retro') paintLED($('services'));
    }
  } finally {
    if (current === request) { loading = false; $('refresh').disabled = false; $('services').setAttribute('aria-busy', 'false'); }
  }
}
function stationPicker(inputId, listId, helpId, select) {
  const input = $(inputId), list = $(listId), help = $(helpId);
  let matches = [], revision = 0, timer;
  const label = s => `${s.name} — ${s.crs}`;
  const selected = () => matches.find(s => label(s) === input.value);
  input.addEventListener('keydown', event => {
    if(event.key === 'ArrowDown' && !list.hidden) { event.preventDefault(); list.querySelector('button')?.focus(); }
    if(event.key === 'Escape' && !list.hidden) { event.preventDefault(); event.stopPropagation(); list.hidden = true; }
  });
  list.addEventListener('keydown', event => {
    const buttons = [...list.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if(event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); list.hidden = true; input.focus(); }
    if(event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); const next = index + (event.key === 'ArrowDown' ? 1 : -1);
      if(next < 0) input.focus(); else buttons[Math.min(next,buttons.length-1)]?.focus();
    }
  });
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-station]');
    if(!button) return;
    const station = matches[Number(button.dataset.station)];
    input.value = label(station); input.setCustomValidity('');
    ++revision; clearTimeout(timer); select(station); list.hidden = true; help.textContent = ''; input.focus();
  });
  input.addEventListener('input', () => {
    clearTimeout(timer); const id = ++revision;
    input.setCustomValidity(''); help.textContent = '';
    if(selected()) { select(selected()); list.hidden = true; return; }
    const query = input.value.trim();
    list.hidden = true;
    if(!query) { list.replaceChildren(); return; }
    timer = setTimeout(async () => {
      try {
        const result = await api.searchStations(query);
        if(id !== revision) return;
        matches = result;
        list.innerHTML = matches.map((s,i) => `<button type="button" data-station="${i}">${escape(label(s))}</button>`).join('');
        list.hidden = !matches.length;
        help.textContent = matches.length ? '' : 'No matching stations.';
      } catch { if(id === revision) help.textContent = 'Station search unavailable. Try again.'; }
    }, 300);
  });
  return {
    reset(station) {
      clearTimeout(timer); ++revision; matches = station ? [station] : [];
      input.value = station ? label(station) : ''; input.setCustomValidity(''); help.textContent = '';
      list.replaceChildren(); list.hidden = true;
      if(station) select(station);
    },
    selected
  };
}
const homePicker = stationPicker('station-search', 'home-suggestions', 'station-help', station => {
  $('station-select').innerHTML = `<option value="${escape(station.crs)}" data-name="${escape(station.name)}">${escape(station.name)}</option>`;
});
const favouritePicker = stationPicker('favourite', 'favourite-suggestions', 'favourite-help', () => {});
let recent = recentStations({crs:settings.crs,name:settings.stationName}, read('recentStations'));
function rememberStation() {
  recent = recentStations({crs:settings.crs,name:settings.stationName}, recent);
  write('recentStations', recent);
}
async function switchStation(station) {
  $('station-switcher').close();
  if (station.crs === settings.crs) return;
  settings = validateSettings({...settings,crs:station.crs,stationName:station.name});
  const saved = write('settings',settings);
  rememberStation();
  board = null; ++request; loading = false;
  applySettings(); await openBoard();
  if(!saved) setUpdateStatus($('update-status').textContent + ' · Station could not be saved on this device');
}
const quickPicker = stationPicker('quick-station-search','quick-suggestions','quick-help',switchStation);
let destinationRevision = 0, destinationStation = null, journeyOrigin = null;
async function loadDestinationJourneys(station) {
  const revision = ++destinationRevision;
  destinationStation = station;
  $('destination-results').replaceChildren();
  $('refresh-journeys').hidden = false;
  $('refresh-journeys').disabled = true;
  $('journey-search-status').textContent = 'Finding direct trains…';
  try {
    if(station.crs === journeyOrigin.crs) throw new Error('same-station');
    const result = await api.getJourneys({from:journeyOrigin.crs,to:station.crs});
    if(revision !== destinationRevision || !$('destination-journeys').open) return;
    $('journey-search-status').textContent = `${api.mock ? 'Demo · Not for travel · ' : ''}Direct trains · ${result.date} · Updated ${time(result.receivedAt)}`;
    $('destination-results').innerHTML = result.journeys.length ? `<p class="hint">Scheduled departure and arrival times. Live status is shown where supplied.</p><table class="destination-table"><caption>${escape(journeyOrigin.name)} to ${escape(station.name)}</caption><thead><tr><th>Departs</th><th>Arrives</th><th>Platform</th></tr></thead><tbody>${result.journeys.map(j => `<tr><td><strong>${escape(j.departure)}</strong></td><td>${escape(j.arrival)}${j.arrival < j.departure ? '<small>Next day</small>' : ''}</td><td>${escape(j.platform || '—')}</td></tr><tr class="journey-secondary"><td colspan="3"><span class="status ${escape(j.status)}">${escape(statusText({status:j.status}))}</span> · ${j.duration} min${j.operator ? ` · ${escape(j.operator)}` : ''}</td></tr>`).join('')}</tbody></table>` : '<p>No direct trains found in the current search. Try another destination or refresh later.</p>';
  } catch(error) {
    if(revision === destinationRevision) $('journey-search-status').textContent = error.message === 'same-station' ? 'Choose a destination different from your starting station.' : 'Journey information temporarily unavailable. Please try refreshing.';
  } finally { if(revision === destinationRevision) $('refresh-journeys').disabled = false; }
}
const destinationPicker = stationPicker('destination-search','destination-suggestions','destination-help',loadDestinationJourneys);
$('next-trains-button').addEventListener('click', () => {
  $('station-switcher').close(); ++destinationRevision;
  journeyOrigin = {crs:settings.crs,name:settings.stationName}; destinationStation = null;
  destinationPicker.reset();
  $('journey-origin').textContent = `From ${journeyOrigin.name} — ${journeyOrigin.crs}`;
  $('destination-results').replaceChildren(); $('journey-search-status').textContent = '';
  $('refresh-journeys').hidden = true;
  $('destination-journeys').showModal();
  if(settings.favourite) { $('destination-search').value = settings.favourite; $('destination-search').dispatchEvent(new Event('input')); }
});
$('destination-search').addEventListener('input', () => {
  if(!destinationPicker.selected()) { ++destinationRevision; destinationStation = null; $('destination-results').replaceChildren(); $('journey-search-status').textContent = ''; $('refresh-journeys').hidden = true; }
});
$('refresh-journeys').addEventListener('click', () => { if(destinationStation) loadDestinationJourneys(destinationStation); });
$('close-destination-journeys').addEventListener('click', () => $('destination-journeys').close());
$('destination-journeys').addEventListener('close', () => { ++destinationRevision; destinationPicker.reset(); });
$('station-name').addEventListener('click', () => {
  quickPicker.reset();
  $('recent-stations').innerHTML = recent.map((s,i) => `<button type="button" data-recent="${i}" ${s.crs === settings.crs ? 'aria-current="true"' : ''}>${escape(s.name)} <span>${escape(s.crs)}${s.crs === settings.crs ? ' · Current' : ''}</span></button>`).join('');
  $('station-switcher').showModal();
});
$('recent-stations').addEventListener('click', event => {
  const button = event.target.closest('[data-recent]');
  if(button) switchStation(recent[Number(button.dataset.recent)]);
});
$('close-station-switcher').addEventListener('click', () => $('station-switcher').close());
function openPreferences() {
  const first = !settings.onboarded;
  $('preferences-title').textContent = first ? 'Welcome to Railboard' : 'Settings';
  $('advanced-settings').hidden = first;
  $('close-preferences').hidden = first;
  $('welcome-copy').hidden = !first;
  $('save-preferences').textContent = first ? 'Show board' : 'Save settings';
  homePicker.reset({crs:settings.crs,name:settings.stationName});
  favouritePicker.reset();
  document.querySelector('.retro-preview .sample').innerHTML = `<span aria-label="17:19 Four Oaks" class="led-text">${led('17:19')}<br>${led('Four Oaks')}</span>`;
  document.querySelector(`input[name="theme"][value="${settings.theme}"]`).checked = true;
  $('default-board').value = settings.board;
  $('service-count').value = settings.count;
  $('favourite').value = settings.favourite;
  $('auto-refresh').checked = settings.autoRefresh;
  $('cache-board').checked = settings.cacheBoard;
  $('preferences').showModal();
}
$('preferences-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!homePicker.selected()) {
    $('station-search').setCustomValidity('Choose a station from the suggestions.');
    $('station-search').reportValidity(); return;
  }
  if (favouritePicker.selected()) $('favourite').value = favouritePicker.selected().name;
  const previous = settings;
  settings = validateSettings({ crs: $('station-select').value, stationName: $('station-select').selectedOptions[0]?.dataset.name, theme: new FormData(event.target).get('theme'), board: $('default-board').value, count: Number($('service-count').value), favourite: $('favourite').value.trim(), autoRefresh: $('auto-refresh').checked, cacheBoard: $('cache-board').checked, onboarded: true });
  const saved = write('settings', settings);
  rememberStation();
  if (!settings.cacheBoard) clearBoard();
  const changed = previous.crs !== settings.crs || previous.count !== settings.count || previous.board !== settings.board;
  if(changed) { boardType = settings.board; board = null; ++request; loading=false; }
  $('preferences').close();
  applySettings();
  (changed ? openBoard() : Promise.resolve(board && renderBoard(staleBoard))).then(() => { if (!saved) setUpdateStatus($('update-status').textContent + ' · Preferences could not be saved on this device'); });
});
$('preferences').addEventListener('cancel', event => { if (!settings.onboarded) event.preventDefault(); });
$('settings-button').addEventListener('click', openPreferences);
$('close-preferences').addEventListener('click', () => $('preferences').close());
$('close-journey').addEventListener('click', () => $('journey').close());
$('refresh').addEventListener('click', refresh);
for (const type of ['departures', 'arrivals']) $(type).addEventListener('click', () => { if (type === boardType) return; boardType = type; board = null; ++request; loading=false; applySettings(); openBoard(); });
let disposeDetail = () => {};
$('journey').addEventListener('close', () => disposeDetail());
$('services').addEventListener('click', async event => {
  const button = event.target.closest('[data-index]');
  if (!button || !board) return;
  disposeDetail();
  const stationCrs = board.station.crs;
  const service = {...board.services[Number(button.dataset.index)]};
  const favourite = settings.favourite;
  function renderFavourite(points) {
    const stop = favouriteStop(points, favourite, service.status === 'cancelled');
    if (!stop) return '';
    if (!stop.found) return `<section class="favourite-stop"><h3>Your stop · ${escape(stop.name)}</h3><p>Not listed in the supplied calling points.</p></section>`;
    const prediction = stop.state === 'Expected' ? `Expected ${escape(stop.expected)}` : (stop.state === 'Cancelled' ? '<span class="cancelled">Cancelled</span>' : escape(stop.state));
    return `<section class="favourite-stop"><h3>☆ Your stop · ${escape(stop.name)}</h3><p><strong>Scheduled ${escape(stop.scheduled)}</strong> · ${prediction}</p><p class="hint">Times shown are the supplied calling-point times.</p></section>`;
  }
  const fields = { From: service.origin, To: service.destination, Scheduled: service.scheduled, Expected: service.status === 'cancelled' ? 'Cancelled' : service.expected || 'Unconfirmed', Platform: service.transport === 'bus' ? 'Replacement bus' : `${service.platform || 'Unassigned'}${service.platformChanged ? ' (changed)' : ''}`, Operator: service.operator };
  const groups = service.callingGroups?.length ? service.callingGroups : [{ points: service.callingPoints }];
  const timeline = groups.map(group => `${groups.length > 1 ? `<h4>${escape(group.label)}</h4>` : ''}<ol class="timeline">${group.points.map(point => `<li><span>${escape(point.scheduled)}</span><span>${escape(point.name)}${point.status === 'cancelled' || service.status === 'cancelled' ? '<small class="cancelled">Cancelled</small>' : point.actual ? `<small>Actual ${escape(point.actual)}</small>` : point.expected && point.expected !== point.scheduled ? `<small>Expected ${escape(point.expected)}</small>` : ''}</span></li>`).join('')}</ol>`).join('');
  $('journey-content').innerHTML = `<h2 id="journey-title">${escape(service.scheduled)} to ${escape(service.destination)}</h2><p class="status ${escape(service.status)}">${escape(statusText(service))}</p><dl class="detail-meta">${Object.entries(fields).map(([key, value]) => `<div><dt>${key}</dt><dd class="${key === 'Expected' && service.status === 'cancelled' ? 'cancelled' : ''}">${escape(value)}</dd></div>`).join('')}</dl>${service.reason ? `<p class="reason ${service.status === 'cancelled' ? 'cancelled' : ''}">${escape(service.reason)}</p>` : ''}<h3>Calling points</h3>${groups.some(g => g.points.length) ? timeline : '<div id="live-calling-points" role="status">Loading calling points…</div>'}<p class="hint">${api.mock ? 'Illustrative route and times · Not for travel' : `Platform and operator from board received ${time(board.generatedAt)}`}</p>`;
  $('journey').showModal();
  const summary = document.createElement('div');
  summary.className = 'favourite-summary';
  summary.setAttribute('role', 'status');
  $('journey-content').querySelector('.detail-meta').before(summary);
  if (favourite) summary.textContent = 'Checking your favourite stop…';
  function showFavourite(points) {
    summary.innerHTML = renderFavourite(points);
    const wanted = favourite.trim().replace(/\s+/g,' ').toLowerCase();
    $('journey-content').querySelectorAll('.timeline li').forEach((row, index) => {
      if(wanted && points[index]?.name.trim().replace(/\s+/g,' ').toLowerCase() === wanted) {
        row.classList.add('favourite-call');
        const marker = document.createElement('small'); marker.textContent = '☆ Your stop';
        row.lastElementChild.append(marker);
      }
    });
  }
  if (groups.some(g => g.points.length)) showFavourite(groups.flatMap(g => g.points));
  const target = $('live-calling-points');
  if(target && !api.mock) {
    const controls = document.createElement('section');
    controls.className = 'train-tools';
    controls.innerHTML = '<div class="train-tool-buttons"><button type="button" class="follow-train rail-sign-action" aria-pressed="false">Follow this train</button><button type="button" class="locate-train rail-sign-action" aria-expanded="false">Where is my train?</button></div><p class="detail-updated" role="status">Loading calling points…</p><div class="train-location" hidden></div>';
    summary.after(controls);
    const followButton = controls.querySelector('.follow-train');
    const locateButton = controls.querySelector('.locate-train');
    const updateLabel = controls.querySelector('.detail-updated');
    const locationPanel = controls.querySelector('.train-location');
    const trainMap = createTrainMap();
    const expansion = expandableMap($('journey'), locationPanel, () => trainMap.resize());
    const clearLocation = message => { expansion.reset(); trainMap.destroy(); locationPanel.textContent = message; };
    let disposed = false, points = null, refreshing = false, locating = false, locationRevision = 0;
    const active = () => !disposed && target.isConnected && $('journey').open;
    async function locate() {
      if(!active() || locating || locationPanel.hidden) return;
      if(!points) { locationPanel.textContent = 'Load calling points before locating this train.'; return; }
      locating = true; const revision = ++locationRevision;
      if(!locationPanel.querySelector('.train-map')) locationPanel.textContent = 'Checking estimated position…';
      try {
        const position = await api.getTrainPosition({service,points});
        if(!active() || locationPanel.hidden || revision !== locationRevision) return;
        if(!position) { clearLocation('A reliable current position is not available for this service.'); return; }
        if(!locationPanel.querySelector('.train-map')) locationPanel.innerHTML = '<h3>Estimated position</h3><button type="button" class="expand-map rail-sign-action" aria-expanded="false">Expand map</button><p class="position-report"></p><div class="train-map" role="region" aria-label="Estimated train position map"></div><p class="map-error hint" role="status"></p><p class="map-credit hint"></p>';
        locationPanel.querySelector('.position-report').textContent = `${position.last ? `Last reported: ${position.last}.` : ''} ${position.next ? `Next: ${position.next}.` : ''}`;
        locationPanel.querySelector('.map-credit').textContent = `Estimated, not GPS · Map feed ${time(position.generatedAt)}`;
        await trainMap.show(locationPanel.querySelector('.train-map'), position, () => {
          const warning = locationPanel.querySelector('.map-error');
          if(warning) warning.textContent = 'Some map detail could not load. Close and reopen the map to retry.';
        });
      } catch { if(active() && !locationPanel.hidden && revision === locationRevision) clearLocation('Map or position temporarily unavailable. Close and reopen the map to try again.'); }
      finally { locating = false; }
    }
    async function refreshDetail() {
      if(!active() || refreshing || document.hidden) return;
      refreshing = true;
      try {
      const result = await api.getServiceDetails({crs:stationCrs, service});
      if(!active()) return;
      points = result;
      const selectedCall = points.find(p => p.here);
      if(selectedCall) {
        const status = detailStatus(service, selectedCall);
        service.status = status; service.expected = status === 'cancelled' ? null : selectedCall.expected;
        service.delay = null;
        const statusLine = $('journey-content').querySelector(':scope > .status');
        statusLine.textContent = statusText(service); statusLine.className = `status ${status}`;
        const expectedField = [...$('journey-content').querySelectorAll('.detail-meta dt')].find(dt => dt.textContent === 'Expected');
        if(expectedField) expectedField.nextElementSibling.textContent = status === 'cancelled' ? 'Cancelled' : selectedCall.expected || (status === 'on-time' ? 'On time' : 'Unconfirmed');
        if(expectedField) expectedField.nextElementSibling.classList.toggle('cancelled', status === 'cancelled');
        $('journey-content').querySelector('.reason')?.classList.toggle('cancelled', status === 'cancelled');
      }
      target.innerHTML = points.length ? `<ol class="timeline">${points.map(p => `<li class="${p.here ? 'current-call' : p.passed ? 'passed-call' : ''}"><span>${escape(p.scheduled)}</span><span>${escape(p.name)}${p.here ? '<small>Selected station</small>' : ''}${p.status === 'cancelled' ? '<small class="cancelled">Cancelled</small>' : p.expected && p.expected !== p.scheduled ? `<small>Expected ${escape(p.expected)}</small>` : ''}${p.passed ? '<small>Passed</small>' : ''}</span></li>`).join('')}</ol>` : 'No calling points available for this service.';
      showFavourite(points);
      const progress = service.status === 'cancelled' ? '' : journeyProgress(points);
      if(progress) $('journey-content').querySelector(':scope > .status').textContent = progress;
      if(progress === 'Journey complete') {
        follower.stop(); followButton.setAttribute('aria-pressed','false');
        followButton.textContent = 'Journey complete'; followButton.disabled = true;
        locateButton.disabled = true; expansion.reset(); locationPanel.hidden = true; trainMap.destroy();
        locateButton.setAttribute('aria-expanded','false'); ++locationRevision;
      }
      updateLabel.textContent = `Calling points received ${time(new Date())}${followButton.getAttribute('aria-pressed') === 'true' ? ' · Following every 30s while visible' : ''}`;
      if(!locationPanel.hidden) await locate();
    } catch {
      if(!active()) return;
      updateLabel.textContent = points ? 'Update failed · Showing previously loaded calling points.' : 'Calling points unavailable. Try Follow this train to retry.';
      if(!points) {
        if(favourite) summary.textContent = 'Your stop information is unavailable until calling points can be loaded.';
        target.textContent = 'Calling points temporarily unavailable.';
      }
      if(!locationPanel.hidden) { ++locationRevision; clearLocation('Position unavailable until live updates recover.'); }
    } finally { refreshing = false; }
    }
    const follower = createFollower(refreshDetail);
    followButton.addEventListener('click', () => {
      const following = followButton.getAttribute('aria-pressed') !== 'true';
      followButton.setAttribute('aria-pressed',String(following));
      followButton.textContent = following ? 'Stop following' : 'Follow this train';
      if(following) follower.start();
      else { follower.stop(); updateLabel.textContent = 'Following paused · Times remain as last received.'; }
    });
    locateButton.addEventListener('click', () => {
      locationPanel.hidden = !locationPanel.hidden;
      locateButton.setAttribute('aria-expanded',String(!locationPanel.hidden));
      if(!locationPanel.hidden) locate();
      else { ++locationRevision; clearLocation(''); }
    });
    const resume = () => { if(!document.hidden) follower.resume(); };
    const offline = () => {
      if(!active()) return;
      updateLabel.textContent = 'Offline · Showing previously received information.';
      if(!locationPanel.hidden) { ++locationRevision; clearLocation('Position unavailable while offline.'); }
    };
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('online',resume);
    window.addEventListener('offline',offline);
    disposeDetail = () => { disposed = true; follower.dispose(); expansion.dispose(); trainMap.destroy(); ++locationRevision; document.removeEventListener('visibilitychange',resume); window.removeEventListener('online',resume); window.removeEventListener('offline',offline); };
    await refreshDetail();
  }
});
setInterval(() => { if (settings.autoRefresh && !document.hidden && !loading) refresh(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && settings.autoRefresh && (!board || Date.now() - Date.parse(board.generatedAt) >= 30000)) refresh(); });
window.addEventListener('online', refresh);
window.addEventListener('offline', () => { if (board) renderBoard(true); });
applySettings();
openBoard();
if (!settings.onboarded) openPreferences();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'})
  .then(registration => watchUpdates(registration, {button:$('app-update')}))
  .catch(() => { $('refresh-status').hidden = false; $('refresh-status').textContent = 'Offline shell unavailable'; });
