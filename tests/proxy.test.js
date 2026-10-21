import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../worker/index.js';
const origin='https://railboard.morgantech.co.uk';
const env={ALLOWED_ORIGINS:origin};
const req=(path='/boards/BMV/departures?limit=6',site=origin)=>new Request(`https://proxy.test${path}`,{headers:{Origin:site}});
test('proxy restricts destinations, parameters, origins and methods',async()=>{
  const deps={fetch:()=>assert.fail('must not fetch')};
  for(const [path,status] of [['/arbitrary',404],['/boards/BMV/departures?limit=999',400],['/stations?q=x&url=https://other.test',400]]) assert.equal((await handleRequest(req(path),env,{},deps)).status,status);
  assert.equal((await handleRequest(req(undefined,'https://other.test'),env,{},deps)).status,403);
  assert.equal((await handleRequest(new Request('https://proxy.test/stations',{method:'POST'}),env,{},deps)).status,405);
});
test('proxy returns browser CORS headers and reuses successful cache',async()=>{
  let calls=0;const saved=new Map();const jobs=[];
  const deps={cache:{match:async k=>saved.get(k.url)?.clone(),put:async(k,r)=>saved.set(k.url,r)},fetch:async(url,options)=>{
    calls++;assert.equal(url.origin,'https://api.railinfo.uk');assert.equal(options.redirect,'manual');
    return Response.json({departures:[]});
  }};
  const ctx={waitUntil:p=>jobs.push(p)};
  const first=await handleRequest(req(),env,ctx,deps);assert.equal(first.status,200);assert.equal(first.headers.get('Access-Control-Allow-Origin'),origin);
  await Promise.all(jobs);assert.equal((await handleRequest(req(),env,ctx,deps)).status,200);assert.equal(calls,1);
});
test('rate limits stay visible to browser and malformed upstream data fails',async()=>{
  const limited=await handleRequest(req(),env,{}, {fetch:async()=>new Response('',{status:429,headers:{'Retry-After':'120'}})});
  assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'120');assert.equal(limited.headers.get('Access-Control-Expose-Headers'),'Retry-After, X-Railboard-Request-Id');
  const broken=await handleRequest(req(),env,{}, {fetch:async()=>Response.json({error:'bad'})});assert.equal(broken.status,502);
});

test('service proxy allows only validated lookups and rejects malformed routes',async()=>{
 const path='/services/lookup?crs=BMV&dep=1742&date=2026-09-10';
 const result=await handleRequest(req(path),env,{}, {fetch:async url=>{assert.equal(url.pathname,'/services/lookup');assert.equal(url.searchParams.get('dep'),'1742');return Response.json({calls:[]})}});
 assert.equal(result.status,200);assert.equal(result.headers.get('Access-Control-Allow-Origin'),origin);
 for(const bad of [path+'&url=x',path.replace('1742','2960'),path.replace('BMV','../')]) assert.equal((await handleRequest(req(bad),env,{}, {fetch:()=>assert.fail('invalid query reached upstream')})).status,400);
 assert.equal((await handleRequest(req(path),env,{}, {fetch:async()=>Response.json({})})).status,502);
});

test('map route rejects query injection and malformed feeds',async()=>{
 const path='/map/trains';
 const good=await handleRequest(req(path),env,{}, {fetch:async url=>{assert.equal(url.origin,'https://api.railinfo.uk');assert.equal(url.pathname,path);return Response.json({generated_at:'2026-09-12T12:00:00Z',trains:[]})}});
 assert.equal(good.status,200);
 assert.equal((await handleRequest(req(path+'?url=bad'),env,{}, {fetch:()=>assert.fail()})).status,400);
 assert.equal((await handleRequest(req(path),env,{}, {fetch:async()=>Response.json({trains:[]})})).status,502);
});

test('journey proxy fixes direct mode and limits while rejecting unsafe parameters',async()=>{
 const path='/journeys?from=BMV&to=BHM';
 const result=await handleRequest(req(path),env,{}, {fetch:async url=>{assert.equal(url.searchParams.get('direct'),'true');assert.equal(url.searchParams.get('limit'),'6');return Response.json({journeys:[]})}});assert.equal(result.status,200);
 for(const query of [path+'&direct=false',path.replace('BHM','BMV'),path+'&url=https://bad.test']) assert.equal((await handleRequest(req(query),env,{}, {fetch:()=>assert.fail()})).status,400);
});

test('failures carry a specific code, a reference and a readable detail',async()=>{
 const ref=/^RB-[A-Z2-9]{4}$/;
 const run=async fetch=>{const r=await handleRequest(req(),env,{},{fetch});return [r,await r.json()]};
 let [r,b]=await run(async()=>Response.json({error:'bad'}));
 assert.equal(r.status,502);assert.equal(b.code,'UPSTREAM_SHAPE');assert.match(b.ref,ref);assert.equal(r.headers.get('X-Railboard-Request-Id'),b.ref);assert.match(b.detail,/departures/);
 [r,b]=await run(async()=>new Response('',{status:503}));
 assert.equal(b.code,'UPSTREAM_STATUS');assert.equal(b.upstreamStatus,503);
 [r,b]=await run(async()=>new Response('<html>',{status:200}));
 assert.equal(b.code,'UPSTREAM_SHAPE');
 [r,b]=await run(async()=>{throw new DOMException('slow','TimeoutError')});
 assert.equal(b.code,'UPSTREAM_TIMEOUT');
 [r,b]=await run(async()=>{throw new TypeError('network')});
 assert.equal(b.code,'UPSTREAM_UNREACHABLE');
 [r,b]=await run(async()=>new Response('',{status:429}));
 assert.equal(b.code,'RATE_LIMITED');
 const bad=await handleRequest(req('/boards/BMV/departures?limit=999'),env,{},{fetch:()=>assert.fail()});
 assert.equal((await bad.json()).code,'INVALID_QUERY');
 const ids=new Set();for(let i=0;i<20;i++)ids.add((await handleRequest(req('/arbitrary'),env,{},{})).headers.get('X-Railboard-Request-Id'));assert.ok(ids.size>1);
});

test('health is cheap by default and probes the upstream feed on request',async()=>{
 const plain=await handleRequest(req('/health'),env,{},{fetch:()=>assert.fail('plain health must not call upstream')});
 assert.deepEqual(await plain.json(),{status:'ok',version:'1.2.0'});
 const ok=await (await handleRequest(req('/health?deep=1'),env,{},{fetch:async url=>{assert.equal(url.origin,'https://api.railinfo.uk');return Response.json([{crs:'BMV'}])}})).json();
 assert.equal(ok.status,'ok');assert.equal(ok.upstream.ok,true);assert.ok(Number.isFinite(ok.upstream.ms));
 const shape=await (await handleRequest(req('/health?deep=1'),env,{},{fetch:async()=>Response.json({})})).json();
 assert.equal(shape.status,'degraded');assert.equal(shape.upstream.code,'UPSTREAM_SHAPE');
 const down=await (await handleRequest(req('/health?deep=1'),env,{},{fetch:async()=>new Response('',{status:500})})).json();
 assert.equal(down.upstream.code,'UPSTREAM_STATUS');assert.equal(down.upstream.httpStatus,500);
 const slow=await (await handleRequest(req('/health?deep=1'),env,{},{fetch:async()=>{throw new DOMException('x','TimeoutError')}})).json();
 assert.equal(slow.upstream.code,'UPSTREAM_TIMEOUT');
});
