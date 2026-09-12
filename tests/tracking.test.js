import test from 'node:test';
import assert from 'node:assert/strict';
import {matchTrainPosition,createFollower} from '../src/tracking.js';
const now = Date.parse('2026-09-12T14:00:00Z');
const service = {scheduled:'15:10',serviceDate:'2026-09-12',day:0};
const points = [{crs:'HFD',scheduled:'14:00'}];
const train = {id:'123',link_crs:'HFD',link_dep:'1400',lat:52.3,lon:-2.1,last:{name:'Droitwich Spa'},next:{name:'Bromsgrove'}};
const feed = {generated_at:new Date(now).toISOString(),trains:[train]};
test('map matches a unique origin/time on the correct date with validated coordinates',()=>{
 assert.equal(matchTrainPosition(feed,service,points,now).next,'Bromsgrove');
 assert.equal(matchTrainPosition({...feed,trains:[train,train]},service,points,now),null);
 assert.equal(matchTrainPosition(feed,{...service,day:1},points,now),null);
 assert.equal(matchTrainPosition(feed,service,points,now+121000),null);
 assert.equal(matchTrainPosition({...feed,trains:[{...train,lat:'52'}]},service,points,now),null);
 assert.equal(matchTrainPosition(feed,service,[{crs:'BMV',scheduled:'14:00'}],now),null);
 assert.equal(matchTrainPosition(feed,{...service,scheduled:'00:10'},points,now),null);
});
test('following avoids overlapping requests, pauses when hidden and stops on close',async()=>{
 let tick, calls=0, hidden=false, release, cancelled=0;
 const follower=createFollower(async()=>{calls++;await new Promise(r=>release=r)}, {visible:()=>!hidden,schedule:(fn,ms)=>{assert.equal(ms,30000);tick=fn;return 1},cancel:()=>cancelled++});
 const first=follower.start(); await tick(); assert.equal(calls,1); release();await first;
 hidden=true;await tick();assert.equal(calls,1);
 hidden=false;const resumed=follower.resume();assert.equal(calls,2);release();await resumed;
 follower.dispose();await tick();await follower.start();assert.equal(calls,2);assert.equal(cancelled,1);
});
