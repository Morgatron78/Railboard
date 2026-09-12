import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBoard, createLiveProvider, clockValue } from '../src/provider.js';
import { validateSettings } from '../src/storage.js';
import { led } from '../src/led.js';
const raw={crs:'BMV',name:'Bromsgrove',kind:'departures',date:'2026-09-10',departures:[{public_dep:'2358',destination:'Hereford',etd:'00:03',variation_min:5,status:'late',live_train_id:'A|BMV',sched_platform:'2',live_platform:'3',operator:'West Midlands Railway',day:1,stops:7}]};
test('maps actual provider fields including delay, platform change, arrivals and next day',()=>{
 const b=normalizeBoard(raw,'departures',6);assert.equal(b.services[0].scheduled,'23:58');assert.equal(b.services[0].delay,5);assert.equal(b.services[0].platformChanged,true);assert.equal(b.services[0].day,1);assert.deepEqual(b.services[0].callingPoints,[]);
 const a=normalizeBoard({...raw,kind:'arrivals'},'arrivals',6);assert.equal(a.services[0].origin,'Hereford');assert.equal(a.services[0].destination,'Bromsgrove');
 assert.throws(()=>normalizeBoard({},'departures',6));assert.equal(clockValue('2460'),null);
});
test('cancellation wins and missing predictions are not labelled on time',()=>{
 const b=normalizeBoard({...raw,departures:[{...raw.departures[0],cancelled:true},{public_dep:'1200'}]},'departures',6);
 assert.equal(b.services[0].status,'cancelled');assert.equal(b.services[0].expected,null);assert.equal(b.services[1].status,'unknown');
});
test('deduplicates requests, searches remotely, and honours rate-limit cooldown',async()=>{
 let calls=0;let release;const gate=new Promise(r=>release=r);
 const p=createLiveProvider('https://example.test',async()=>{calls++;await gate;return Response.json(raw)});
 const a=p.getDepartures({crs:'BMV',count:6});const b=p.getDepartures({crs:'BMV',count:6});release();await Promise.all([a,b]);assert.equal(calls,1);
 const limited=createLiveProvider('https://example.test',async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}})});
 await assert.rejects(limited.getDepartures({crs:'BMV',count:6}));const before=calls;await assert.rejects(limited.searchStations('Reading'));assert.equal(calls,before);
 const search=createLiveProvider('https://example.test',async()=>Response.json([{crs:'RDG',description:'Reading'}]));assert.deepEqual(await search.searchStations('Reading'),[{crs:'RDG',name:'Reading'}]);
});
test('persists stations beyond the mock list and renders genuine LED cells',()=>{
 assert.equal(validateSettings({crs:'RDG',stationName:'Reading'}).crs,'RDG');
 const output=led('17:19');assert.ok(output.includes('<circle'));assert.ok(output.includes('unlit'));assert.ok(!led('<script>').includes('<script>'));
});

test('service lookup uses the service date and validates and normalises calling points',async()=>{
 let url;
 const provider=createLiveProvider('https://example.test',async u=>{url=new URL(u);return Response.json({calls:[{crs:'BMV',name:'Bromsgrove',scheduled:'2358',expected:'00:03',here:true,passed:false,status:'late'}]})});
 const service=normalizeBoard(raw,'departures',6).services[0];
 const points=await provider.getServiceDetails({crs:'BMV',service});
 assert.equal(url.pathname,'/services/lookup');assert.equal(url.searchParams.get('date'),'2026-09-11');assert.equal(url.searchParams.get('dep'),'2358');assert.equal(points[0].scheduled,'23:58');assert.equal(points[0].expected,'00:03');assert.equal(points[0].here,true);
 const bad=createLiveProvider('https://example.test',async()=>Response.json({calls:[{crs:'RDG',name:'Reading',scheduled:'1200'}]}));
 await assert.rejects(bad.getServiceDetails({crs:'BMV',service}),/route unavailable/);
 const unavailable=createLiveProvider('https://example.test',async()=>new Response('',{status:502}));
 await assert.rejects(unavailable.getServiceDetails({crs:'BMV',service}),/502/);
});

test('direct journeys validate routing and preserve scheduled times without inventing predictions',async()=>{
 const {normalizeJourneys}=await import('../src/provider.js');
 const raw={from:{crs:'BMV'},to:{crs:'BHM'},date:'2026-09-12',journeys:[{changes:0,dep:'2350',arr:'0020',duration_min:30,status:'on_time',legs:[{from_crs:'BMV',to_crs:'BHM',dep_platform:'2',status:'late'}]}]};
 const result=normalizeJourneys(raw,'BMV','BHM').journeys[0];assert.equal(result.arrival,'00:20');assert.equal(result.status,'delayed');assert.equal(result.expected,undefined);
 assert.equal(normalizeJourneys({...raw,journeys:[]},'BMV','BHM').journeys.length,0);
 assert.throws(()=>normalizeJourneys(raw,'BMV','RDG'));
 assert.throws(()=>normalizeJourneys({...raw,journeys:[{...raw.journeys[0],changes:1}]},'BMV','BHM'));
 let url;const provider=createLiveProvider('https://example.test',async u=>{url=u;return Response.json(raw)});
 await provider.getJourneys({from:'BMV',to:'BHM'});assert.equal(url,'https://example.test/journeys?from=BMV&to=BHM');
 await assert.rejects(provider.getJourneys({from:'BMV',to:'BMV'}));
});
