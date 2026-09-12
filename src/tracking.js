// Match only a unique service on a fresh map; never guess by destination alone.
export function matchTrainPosition(raw, service, points, now = Date.now()) {
  const generated = Date.parse(raw?.generated_at);
  if (!Array.isArray(raw?.trains) || !Number.isFinite(generated)) throw new Error('Invalid map response');
  if(now - generated > 120000 || generated - now > 30000) return null;
  const origin = points[0];
  if(!origin?.crs || !origin.scheduled || origin.scheduled > service.scheduled) return null;
  const date = new Date(`${service.serviceDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (service.day || 0));
  const feedDate = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(generated));
  if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== feedDate) return null;
  const candidates = raw.trains.filter(t => t.link_crs === origin.crs && t.link_dep?.replace(':','') === origin.scheduled.replace(':',''));
  if(candidates.length !== 1) return null;
  const train = candidates[0];
  if(!Number.isFinite(train.lat) || !Number.isFinite(train.lon) || Math.abs(train.lat)>90 || Math.abs(train.lon)>180) return null;
  return {lat:train.lat,lon:train.lon,generatedAt:new Date(generated).toISOString(),last:typeof train.last?.name === 'string' ? train.last.name : null,next:typeof train.next?.name === 'string' ? train.next.name : null};
}

export function createFollower(refresh, {visible = () => !document.hidden, schedule = setInterval, cancel = clearInterval} = {}) {
  let timer = null, busy = false, disposed = false;
  async function tick() {
    if(disposed || busy || !visible()) return;
    busy = true;
    try { await refresh(); } finally { busy = false; }
  }
  return {
    start() { if(disposed || timer !== null) return; timer = schedule(tick,30000); return tick(); },
    stop() { if(timer !== null) cancel(timer); timer = null; },
    resume() { if(timer !== null) return tick(); },
    dispose() { this.stop(); disposed = true; }
  };
}
