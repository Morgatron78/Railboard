const UPSTREAM = 'https://api.railinfo.uk';
export const WORKER_VERSION = '1.2.0';
const refId = () => `RB-${Array.from(crypto.getRandomValues(new Uint8Array(4)), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('')}`;
export async function handleRequest(request, env = {}, ctx = {}, deps = {}) {
  const ref = refId();
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' };
  headers['X-Railboard-Request-Id']=ref;
  const respond = (body,status=200,code) => Response.json(status >= 400 ? {...body,code:code || body.code || 'REQUEST_REJECTED',ref} : body,{status,headers});
  if(origin && !allowed.includes(origin)) return respond({error:'Origin not allowed'},403,'ORIGIN_NOT_ALLOWED');
  if(origin) headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Expose-Headers']='Retry-After, X-Railboard-Request-Id';
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
  if(request.method!=='GET') return respond({error:'Method not allowed'},405,'METHOD_NOT_ALLOWED');
  if(url.pathname==='/health') {
    if(!url.searchParams.has('deep')) return respond({status:'ok',version:WORKER_VERSION});
    const probe=new URL(UPSTREAM);probe.pathname='/stations';probe.searchParams.set('q','bromsgrove');
    const started=Date.now();
    try {
      const result=await (deps.fetch || fetch)(probe,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(10000)});
      const ms=Date.now()-started;
      if(!result.ok) return respond({status:'degraded',version:WORKER_VERSION,upstream:{ok:false,code:result.status===429?'RATE_LIMITED':'UPSTREAM_STATUS',httpStatus:result.status,ms}});
      const data=await result.json().catch(()=>null);
      const shaped=Array.isArray(data);
      return respond({status:shaped?'ok':'degraded',version:WORKER_VERSION,upstream:{ok:shaped,...(shaped?{}:{code:'UPSTREAM_SHAPE',detail:'Station search did not return a list'}),httpStatus:result.status,ms}});
    } catch (error) {
      return respond({status:'degraded',version:WORKER_VERSION,upstream:{ok:false,code:error.name==='TimeoutError'?'UPSTREAM_TIMEOUT':'UPSTREAM_UNREACHABLE',ms:Date.now()-started}});
    }
  }
  const upstream = new URL(UPSTREAM);
  const board = /^\/boards\/([A-Z]{3})\/(departures|arrivals)$/.test(url.pathname);
  const detail = url.pathname === '/services/lookup';
  const map = url.pathname === '/map/trains';
  const journeys = url.pathname === '/journeys';
  if(journeys) {
    const from = url.searchParams.get('from'), to = url.searchParams.get('to');
    if(!/^[A-Z]{3}$/.test(from || '') || !/^[A-Z]{3}$/.test(to || '') || from === to || [...url.searchParams.keys()].some(k=>!['from','to'].includes(k))) return respond({error:'Invalid journey query'},400,'INVALID_QUERY');
    upstream.pathname='/journeys';
    for(const [key,value] of Object.entries({from,to,direct:'true',limit:'6'})) upstream.searchParams.set(key,value);
  } else if(map) {
    if([...url.searchParams].length) return respond({error:'Invalid map query'},400,'INVALID_QUERY');
    upstream.pathname = '/map/trains';
  } else if(detail) {
    const { crs, dep, date } = Object.fromEntries(url.searchParams);
    if(!/^[A-Z]{3}$/.test(crs || '') || !/^([01]\d|2[0-3])[0-5]\d$/.test(dep || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || [...url.searchParams.keys()].some(k=>!['crs','dep','date'].includes(k))) return respond({error:'Invalid service query'},400,'INVALID_QUERY');
    upstream.pathname=url.pathname;
    for(const [key,value] of Object.entries({crs,dep,date})) upstream.searchParams.set(key,value);
  } else if(board) {
    const limit=url.searchParams.get('limit') || '6';
    if(!['4','6','8','10','20','30'].includes(limit) || [...url.searchParams.keys()].some(k=>k!=='limit')) return respond({error:'Invalid parameters'},400,'INVALID_QUERY');
    upstream.pathname=url.pathname;upstream.searchParams.set('limit',limit);
  } else if(url.pathname==='/stations') {
    const q=(url.searchParams.get('q')||'').trim();
    if(!q || q.length>100 || [...url.searchParams.keys()].some(k=>k!=='q')) return respond({error:'Invalid station query'},400,'INVALID_QUERY');
    upstream.pathname='/stations';upstream.searchParams.set('q',q);
  } else return respond({error:'Not found'},404,'NOT_FOUND');
  const cache=deps.cache || globalThis.caches?.default;
  const key=new Request(`${url.origin}/cached${upstream.pathname}${upstream.search}`);
  const log=(code,extra={})=>console.warn(JSON.stringify({ref,code,path:upstream.pathname,...extra}));
  const cached=await Promise.resolve(cache?.match(key)).catch(()=>null);
  if(cached) return respond(await cached.json());
  let result;
  try { result=await (deps.fetch || fetch)(upstream,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(10000)}); }
  catch (error) {
    const code=error.name==='TimeoutError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE';
    log(code,{error:error.name});
    return respond({error:'Rail information temporarily unavailable',detail:code==='UPSTREAM_TIMEOUT' ? 'The rail data feed did not answer in time' : 'The rail data feed could not be reached'},502,code);
  }
  if(result.status===429) {
    const retry=result.headers.get('Retry-After');
    headers['Retry-After']=retry && (/^\d+$/.test(retry)||Number.isFinite(Date.parse(retry))) ? retry : '30';
    log('RATE_LIMITED');
    return respond({error:'Please wait before refreshing'},429,'RATE_LIMITED');
  }
  if(!result.ok) { log('UPSTREAM_STATUS',{status:result.status}); return respond({error:'Rail information temporarily unavailable',detail:`The rail data feed replied with HTTP ${result.status}`,upstreamStatus:result.status},502,'UPSTREAM_STATUS'); }
  const data=await result.json().catch(()=>undefined);
  const missing=data===undefined ? 'a JSON response' : journeys ? !Array.isArray(data?.journeys) && 'journeys' : map ? (!Array.isArray(data?.trains) ? 'trains' : !Number.isFinite(Date.parse(data.generated_at)) && 'generated_at') : detail ? !Array.isArray(data?.calls) && 'calls' : board ? !Array.isArray(data?.departures) && 'departures' : !Array.isArray(data) && 'a list';
  if(missing) { log('UPSTREAM_SHAPE',{missing}); return respond({error:'Invalid upstream response',detail:`The rail data feed changed format: expected ${missing}`},502,'UPSTREAM_SHAPE'); }
  if(cache) ctx.waitUntil?.(Promise.resolve(cache.put(key,Response.json(data,{headers:{'Cache-Control':`public, max-age=${map?30:board || detail || journeys?20:300}`}}))).catch(()=>{}));
  return respond(data);
}
export default {fetch:handleRequest};
