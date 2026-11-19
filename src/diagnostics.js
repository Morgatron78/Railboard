import { read, write } from './storage.js';
export const BUILD = '45';
export const LOG_LIMIT = 20;
const KEY = 'diagnostics';
export class RailboardError extends Error {
  constructor(code, message, { ref = '', status = null, detail = '' } = {}) {
    super(message); this.name = 'RailboardError';
    Object.assign(this, { code, ref, status, detail });
  }
}
const CODES = {
  OFFLINE: ['Your device is offline', 'Saved boards stay available. Live trains return when the connection does.'],
  PROXY_TIMEOUT: ["Railboard can't reach its proxy", 'The proxy did not answer in time. Try again in a minute.'],
  PROXY_UNREACHABLE: ["Railboard can't reach its proxy", 'Your connection may be fine, but the proxy did not respond. Try again in a minute.'],
  PROXY_STATUS: ['The proxy returned an error', 'Try again shortly.'],
  PROXY_BAD_RESPONSE: ['The proxy sent an unreadable reply', 'Try again shortly.'],
  UPSTREAM_TIMEOUT: ['The rail data feed is slow', 'The feed did not answer in time. Try again shortly.'],
  UPSTREAM_UNREACHABLE: ['The rail data feed is unreachable', 'Try again shortly.'],
  UPSTREAM_STATUS: ['The rail data feed has a problem', 'The feed returned an error. Try again shortly.'],
  UPSTREAM_SHAPE: ['The train data source has changed', 'Railboard is working, but the feed replied in a format it does not recognise. Copy the report and send it to the developer.'],
  APP_SHAPE: ['Railboard could not read the train data', 'The reply did not match what this version expects. Copy the report and send it to the developer.'],
  RATE_LIMITED: ['Too many refreshes', 'Wait a moment before refreshing again.'],
  COOLDOWN: ['Waiting before the next refresh', 'Railboard paused requests after a rate limit.']
};
export const describeCode = code => { const [title, advice] = CODES[code] || ['Live trains are unavailable', 'Try again shortly.']; return { title, advice }; };
export const banner = (error, savedAt) => {
  const { title } = describeCode(error?.code);
  return { title, text: savedAt ? `Saved board from ${savedAt}.` : 'No saved board is available.', ref: error?.ref || '', code: error?.code || 'UNKNOWN' };
};
const isIso = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function sanitiseState(raw) {
  const log = Array.isArray(raw?.log) ? raw.log.filter(e => e && isIso(e.at) && typeof e.code === 'string').slice(0, LOG_LIMIT)
    .map(e => ({ at: e.at, code: e.code.slice(0, 40), ref: typeof e.ref === 'string' ? e.ref.slice(0, 12) : '', detail: typeof e.detail === 'string' ? e.detail.slice(0, 160) : '', status: Number.isInteger(e.status) ? e.status : null })) : [];
  return { log, lastSuccess: isIso(raw?.lastSuccess) ? raw.lastSuccess : null };
}
export function createDiagnostics({ load = () => read(KEY), save = v => write(KEY, v), now = () => new Date() } = {}) {
  let state = sanitiseState(load());
  const persist = () => save(state);
  return {
    get entries() { return state.log; },
    get lastSuccess() { return state.lastSuccess; },
    get lastFailure() { return state.log[0]?.at || null; },
    success() { state = { ...state, lastSuccess: now().toISOString() }; persist(); },
    failure(error) {
      const entry = { at: now().toISOString(), code: error?.code || 'UNKNOWN', ref: error?.ref || '', detail: String(error?.detail || '').slice(0, 160), status: Number.isInteger(error?.status) ? error.status : null };
      state = { ...state, log: [entry, ...state.log].slice(0, LOG_LIMIT) }; persist(); return entry;
    },
    clear() { state = { ...state, log: [] }; persist(); }
  };
}
/** Turn the three link results into one sentence a person can act on. */
export function verdictFor(links, online = true) {
  const by = Object.fromEntries(links.map(l => [l.id, l]));
  if (!online) return { tone: 'idle', ...describeCode('OFFLINE') };
  if (by.proxy?.state === 'bad') return { tone: 'bad', ...describeCode(by.proxy.code || 'PROXY_UNREACHABLE') };
  if (by.feed?.state === 'bad') return { tone: 'bad', ...describeCode(by.feed.code || 'UPSTREAM_STATUS') };
  return { tone: 'ok', title: 'Everything is working', advice: 'Railboard, its proxy and the rail data feed all answered.' };
}
export async function runChecks({ base, fetcher = fetch, online = true, timeout = 12000 } = {}) {
  const app = { id: 'app', label: 'Railboard app', state: 'ok', detail: `Build ${BUILD}`, ms: 0 };
  const idle = (id, label, detail) => ({ id, label, state: 'idle', detail, ms: null });
  if (!online) return finish([app, idle('proxy', 'Railboard proxy', 'Device is offline'), idle('feed', 'railinfo feed', 'Not tested')], false);
  const started = Date.now();
  let proxy, feed, version = null;
  try {
    const response = await fetcher(`${base}/health?deep=1`, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(timeout) });
    const ms = Date.now() - started;
    const body = response.ok ? await response.json().catch(() => null) : null;
    if (!response.ok || !body) { proxy = { id: 'proxy', label: 'Railboard proxy', state: 'bad', code: 'PROXY_STATUS', detail: `Replied with HTTP ${response.status}`, ms }; feed = idle('feed', 'railinfo feed', 'Not tested'); }
    else {
      version = typeof body.version === 'string' ? body.version.slice(0, 20) : null;
      proxy = { id: 'proxy', label: 'Railboard proxy', state: 'ok', detail: version ? `Worker ${version}` : 'Answered', ms };
      const u = body.upstream;
      feed = u?.ok ? { id: 'feed', label: 'railinfo feed', state: 'ok', detail: 'Boards, services, map', ms: Number.isFinite(u.ms) ? u.ms : null }
        : { id: 'feed', label: 'railinfo feed', state: 'bad', code: typeof u?.code === 'string' ? u.code : 'UPSTREAM_STATUS', detail: u?.httpStatus ? `HTTP ${u.httpStatus}` : u?.detail || 'No reply', ms: Number.isFinite(u?.ms) ? u.ms : null };
    }
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError';
    proxy = { id: 'proxy', label: 'Railboard proxy', state: 'bad', code: timedOut ? 'PROXY_TIMEOUT' : 'PROXY_UNREACHABLE', detail: timedOut ? `No reply within ${Math.round(timeout / 1000)} s` : 'Could not connect', ms: null };
    feed = idle('feed', 'railinfo feed', 'Not tested');
  }
  return finish([app, proxy, feed], true, version);
  function finish(links, onlineNow, workerVersion = null) { return { links, verdict: verdictFor(links, onlineNow), workerVersion, checkedAt: new Date().toISOString() }; }
}
const stamp = iso => iso ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Europe/London' }).format(new Date(iso)) : 'never';
export function buildReport({ now = new Date(), checks = null, entries = [], lastSuccess = null, context = {} } = {}) {
  const lines = ['Railboard diagnostic report', `Generated: ${stamp(now.toISOString())} (UK)`,
    `Build ${BUILD} · display: ${context.theme || 'unknown'} · station: ${context.crs || '?'} · board: ${context.board || '?'}`,
    `Online: ${context.online === false ? 'no' : 'yes'} · offline files: ${context.shell || 'unknown'} · board on screen: ${context.boardState || 'unknown'}`,
    `Last live board: ${stamp(lastSuccess)}`, ''];
  lines.push('Checks');
  if (checks) {
    checks.links.forEach(l => lines.push(`  ${l.label.padEnd(16)} ${l.state.toUpperCase().padEnd(5)} ${l.ms === null || l.ms === undefined ? '—' : `${l.ms} ms`}  ${l.detail}${l.code ? ` [${l.code}]` : ''}`));
    lines.push(`Verdict: ${checks.verdict.title}`);
  } else lines.push('  not run');
  lines.push('', 'Recent problems');
  if (!entries.length) lines.push('  none');
  entries.forEach(e => lines.push(`  ${stamp(e.at)}  ${e.code}  ${e.ref || '—'}${e.status ? `  HTTP ${e.status}` : ''}${e.detail ? `  ${e.detail}` : ''}`));
  return lines.join('\n');
}
