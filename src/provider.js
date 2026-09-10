import { mockProvider } from './api.js';
import { API_BASE_URL } from './config.js';
const clean = v => typeof v === 'string' ? v : '';
export function clockValue(value) {
  const s = clean(value).replace(':', '');
  return /^([01]\d|2[0-3])[0-5]\d$/.test(s) ? `${s.slice(0,2)}:${s.slice(2)}` : null;
}
export function normalizeBoard(raw, type, count, now = new Date()) {
  if (!raw || !/^[A-Z]{3}$/.test(raw.crs) || !raw.name || raw.kind !== type || !Array.isArray(raw.departures)) throw new Error('Invalid board response');
  return { station: { crs: raw.crs, name: raw.name }, type, generatedAt: now.toISOString(), fetchedAt: now.toISOString(), mock: false, source: 'railinfo', messages: [],
    services: raw.departures.slice(0,count).map((s,i) => {
      if (!s || !clockValue(s.public_dep)) throw new Error('Invalid service');
      const cancelled = s.cancelled === true || s.status === 'cancelled';
      const delay = Number.isFinite(s.variation_min) ? s.variation_min : null;
      const expected = cancelled ? null : clockValue(s.etd);
      const status = cancelled ? 'cancelled' : s.status === 'late' || delay > 0 ? 'delayed' : s.status === 'early' ? 'early' : ['on-time','on_time','ontime'].includes(s.status) ? 'on-time' : s.status === 'scheduled' ? 'scheduled' : 'unknown';
      return { id: clean(s.live_train_id) || `${raw.date}-${s.public_dep}-${i}`, scheduled: clockValue(s.public_dep), expected, status, delay,
        origin: type === 'arrivals' ? clean(s.destination) || 'Unknown' : raw.name,
        destination: type === 'arrivals' ? raw.name : clean(s.destination) || 'Unknown',
        platform: clean(s.live_platform) || clean(s.sched_platform) || null,
        platformChanged: Boolean(s.live_platform && s.sched_platform && s.live_platform !== s.sched_platform),
        operator: clean(s.operator) || 'Not supplied', reason: clean(s.reason), transport: 'train', callingPoints: [],
        day: Number.isInteger(s.day) ? s.day : 0, serviceDate: clean(raw.date), stopCount: Number.isInteger(s.stops) ? s.stops : null };
    }) };
}
export function createLiveProvider(base = API_BASE_URL, fetcher = fetch) {
  const pending = new Map(); let retryAt = 0;
  function get(path) {
    if (Date.now() < retryAt) return Promise.reject(new Error('Please wait before refreshing'));
    if (pending.has(path)) return pending.get(path);
    const promise = (async () => {
      const response = await fetcher(`${base}${path}`, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (response.status === 429) {
        const header = response.headers.get('Retry-After');
        const seconds = header && /^\d+$/.test(header) ? Number(header) : null;
        retryAt = Math.max(Date.now() + 30000, seconds !== null ? Date.now() + seconds * 1000 : Date.parse(header) || 0);
      }
      if (!response.ok) throw new Error(`Board request failed (${response.status})`);
      return response.json();
    })().finally(() => pending.delete(path));
    pending.set(path,promise); return promise;
  }
  async function board(type, { crs,count }) {
    if (!/^[A-Z]{3}$/.test(crs) || ![4,6,8,10].includes(count)) throw new Error('Invalid board options');
    const result = normalizeBoard(await get(`/boards/${crs}/${type}?limit=${count}`),type,count);
    if (result.station.crs !== crs) throw new Error('Station mismatch');
    return result;
  }
  return { mock:false, getDepartures: o => board('departures',o), getArrivals: o => board('arrivals',o),
    async getServiceDetails({crs, service}) {
      if(!/^[A-Z]{3}$/.test(crs) || !clockValue(service.scheduled) || !/^\d{4}-\d{2}-\d{2}$/.test(service.serviceDate)) throw new Error('Invalid service lookup');
      const date = new Date(`${service.serviceDate}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + (service.day || 0));
      const query = new URLSearchParams({crs, dep:service.scheduled.replace(':',''), date:date.toISOString().slice(0,10)});
      const raw = await get(`/services/lookup?${query}`);
      if(!Array.isArray(raw?.calls) || !raw.calls.some(p => p.crs === crs)) throw new Error('Service route unavailable');
      return raw.calls.map(p => {
        if(!clean(p.name) || !clockValue(p.scheduled)) throw new Error('Invalid calling point');
        return {name:p.name, scheduled:clockValue(p.scheduled), expected:clockValue(p.expected), status:clean(p.status), passed:p.passed === true, here:p.here === true};
      });
    },
    async searchStations(query) {
      if (!query.trim()) return [];
      const result = await get(`/stations?q=${encodeURIComponent(query.trim())}`);
      if (!Array.isArray(result)) throw new Error('Invalid station response');
      return result.filter(s => /^[A-Z]{3}$/.test(s.crs) && typeof s.description === 'string').map(s => ({crs:s.crs,name:s.description}));
    } };
}
const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
export const api = demo ? { ...mockProvider,mock:true } : createLiveProvider();
