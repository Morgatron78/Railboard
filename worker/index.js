const UPSTREAM = 'https://api.railinfo.uk';
export async function handleRequest(request, env = {}, ctx = {}, deps = {}) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' };
  const respond = (body,status=200) => Response.json(body,{status,headers});
  if(origin && !allowed.includes(origin)) return respond({error:'Origin not allowed'},403);
  if(origin) headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Expose-Headers']='Retry-After';
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
  if(request.method!=='GET') return respond({error:'Method not allowed'},405);
  if(url.pathname==='/health') return respond({status:'ok'});
  const upstream = new URL(UPSTREAM);
  const board = /^\/boards\/([A-Z]{3})\/(departures|arrivals)$/.test(url.pathname);
  if(board) {
    const limit=url.searchParams.get('limit') || '6';
    if(!['4','6','8','10'].includes(limit) || [...url.searchParams.keys()].some(k=>k!=='limit')) return respond({error:'Invalid parameters'},400);
    upstream.pathname=url.pathname;upstream.searchParams.set('limit',limit);
  } else if(url.pathname==='/stations') {
    const q=(url.searchParams.get('q')||'').trim();
    if(!q || q.length>100 || [...url.searchParams.keys()].some(k=>k!=='q')) return respond({error:'Invalid station query'},400);
    upstream.pathname='/stations';upstream.searchParams.set('q',q);
  } else return respond({error:'Not found'},404);
  const cache=deps.cache || globalThis.caches?.default;
  const key=new Request(`${url.origin}/cached${upstream.pathname}${upstream.search}`);
  try {
    const cached=await cache?.match(key);
    if(cached) return respond(await cached.json());
    const result=await (deps.fetch || fetch)(upstream,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(10000)});
    if(result.status===429) {
      const retry=result.headers.get('Retry-After');
      headers['Retry-After']=retry && (/^\d+$/.test(retry)||Number.isFinite(Date.parse(retry))) ? retry : '30';
      return respond({error:'Please wait before refreshing'},429);
    }
    if(!result.ok) { console.warn('Upstream HTTP status',result.status); return respond({error:'Rail information temporarily unavailable'},502); }
    const data=await result.json();
    if(board ? !Array.isArray(data?.departures) : !Array.isArray(data)) return respond({error:'Invalid upstream response'},502);
    if(cache) ctx.waitUntil(cache.put(key,Response.json(data,{headers:{'Cache-Control':`public, max-age=${board?20:300}`}})).catch(()=>{}));
    return respond(data);
  } catch (error) { console.warn('Proxy request failed',error.name,error.message); return respond({error:'Rail information temporarily unavailable'},502); }
}
export default {fetch:handleRequest};
