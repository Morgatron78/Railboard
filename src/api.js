// Replace this provider with a Worker-backed implementation in v0.2.
// National Rail credentials must never be supplied to this client.
export const stations = [
  ['BMV', 'Bromsgrove'], ['BHM', 'Birmingham New Street'], ['FOU', 'Four Oaks'],
  ['HFD', 'Hereford'], ['LTV', 'Lichfield Trent Valley'], ['WOF', 'Worcester Foregate Street'],
  ['WOS', 'Worcester Shrub Hill'], ['DTW', 'Droitwich Spa'], ['GMV', 'Great Malvern'],
  ['RDC', 'Redditch'], ['UNI', 'University'], ['CNM', 'Cheltenham Spa'],
  ['BRI', 'Bristol Temple Meads'], ['CDF', 'Cardiff Central'], ['MAN', 'Manchester Piccadilly'],
  ['EUS', 'London Euston'], ['PAD', 'London Paddington'], ['EDB', 'Edinburgh'], ['GLC', 'Glasgow Central']
].map(([crs, name]) => ({ crs, name }));
export function searchStations(query = '') {
  const term = query.trim().toLowerCase();
  return stations.filter(s => `${s.name} ${s.crs}`.toLowerCase().includes(term));
}
const clock = date => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(date);
const routes = [
  ['Four Oaks', 'on-time', '2', ['Barnt Green', 'Longbridge', 'Northfield', 'Selly Oak', 'University', 'Five Ways', 'Birmingham New Street', 'Aston', 'Erdington', 'Sutton Coldfield', 'Four Oaks']],
  ['Hereford', 'on-time', '1', ['Droitwich Spa', 'Worcester Foregate Street', 'Worcester Shrub Hill', 'Malvern Link', 'Great Malvern', 'Colwall', 'Ledbury', 'Hereford']],
  ['Lichfield Trent Valley', 'delayed', '2', ['Barnt Green', 'University', 'Birmingham New Street', 'Sutton Coldfield', 'Four Oaks', 'Lichfield City', 'Lichfield Trent Valley']],
  ['Four Oaks', 'cancelled', null, ['University', 'Birmingham New Street', 'Four Oaks']],
  ['Birmingham New Street', 'unknown', null, ['Barnt Green', 'University', 'Birmingham New Street']],
  ['Worcester Foregate Street', 'on-time', '1', ['Droitwich Spa', 'Worcester Foregate Street']],
  ['Longbridge', 'on-time', null, ['Barnt Green', 'Longbridge']],
  ['Lichfield Trent Valley', 'delayed', '3', ['University', 'Birmingham New Street', 'Four Oaks', 'Lichfield Trent Valley']],
  ['Hereford', 'on-time', '1', ['Droitwich Spa', 'Worcester Shrub Hill', 'Great Malvern', 'Hereford']],
  ['Four Oaks', 'on-time', '2', ['University', 'Birmingham New Street', 'Four Oaks']]
];
export function createMockBoard({ crs = 'BMV', type = 'departures', count = 6, scenario = 'normal', now = new Date() } = {}) {
  const station = stations.find(s => s.crs === crs);
  if (!station) throw new Error('Unsupported demo station');
  if (!['departures', 'arrivals'].includes(type)) throw new Error('Invalid board type');
  if (![4, 6, 8, 10].includes(count)) throw new Error('Invalid service count');
  if (scenario === 'error') throw new Error('Demo API unavailable');
  const services = scenario === 'empty' ? [] : routes.slice(0, count).map(([end, status, platform, stops], i) => {
    const time = offset => clock(new Date(now.getTime() + offset * 60000));
    const offset = 5 + i * 10;
    const delay = status === 'delayed' ? (i === 2 ? 3 : 8) : 0;
    const destination = type === 'arrivals' ? station.name : end === station.name ? 'Bromsgrove' : end;
    const origin = type === 'arrivals' ? end === station.name ? 'Bromsgrove' : end : station.name;
    const callingNames = type === 'arrivals' ? [origin, ...stops.slice(0, 3).filter(n => n !== origin && n !== station.name), station.name] : [station.name, ...stops.filter(n => n !== station.name && n !== destination), destination];
    return {
      id: `${crs}-${type}-${now.getTime()}-${i}`, origin, destination, status, platform,
      scheduled: time(offset), expected: status === 'unknown' ? null : time(offset + delay), delay,
      operator: 'West Midlands Railway', transport: i === 6 ? 'bus' : 'train', platformChanged: i === 7,
      reason: status === 'cancelled' ? 'This service has been cancelled because of a shortage of train crew.' : status === 'delayed' ? 'This service is delayed by a signalling fault.' : '',
      callingPoints: callingNames.map((name, j) => {
        const minutes = type === 'arrivals' ? offset - (callingNames.length - 1 - j) * 8 : offset + j * 8;
        return { name, scheduled: time(minutes), expected: status === 'unknown' || status === 'cancelled' ? null : time(minutes + delay) };
      })
    };
  });
  return { station, type, services, generatedAt: now.toISOString(), mock: true };
}
export const mockProvider = {
  searchStations,
  async getDepartures(options) { return createMockBoard({ ...options, type: 'departures' }); },
  async getArrivals(options) { return createMockBoard({ ...options, type: 'arrivals' }); },
  async getServiceDetails(service) { return service; }
};
export function statusText(service) {
  if (service.status === 'cancelled') return 'Cancelled';
  if (service.status === 'unknown') return 'Time unconfirmed';
  if (service.status === 'scheduled') return 'Scheduled';
  if (service.status === 'delayed') return service.expected ? `Expected ${service.expected}${service.delay > 0 ? ` · +${service.delay} min` : ''}` : 'Delayed';
  if (service.status === 'early') return `Expected ${service.expected}`;
  return 'On time';
}
