import test from 'node:test';
import assert from 'node:assert/strict';
import { favouriteStop, detailStatus } from '../src/detail.js';

test('calling-point predictions cannot reverse a cancellation', () => {
  for(const status of ['on_time','late','departed',undefined]) {
    assert.equal(detailStatus({status:'cancelled'},{status}), 'cancelled');
  }
  assert.equal(detailStatus({status:'on-time'},{status:'cancelled'}),'cancelled');
  assert.equal(detailStatus({status:'delayed'},{status:'on_time'}),'on-time');
  assert.equal(detailStatus({status:'on-time'},{status:'late'}),'delayed');
  assert.equal(detailStatus({status:'cancelled'},null),'cancelled');
});

test('favourite stop matches a complete name and retains overnight predictions', () => {
  const points = [{name:'Birmingham New Street',scheduled:'23:58',expected:'00:04'}];
  assert.equal(favouriteStop(points,' Birmingham  New Street ').expected,'00:04');
  assert.equal(favouriteStop(points,'Birmingham').found,false);
  assert.equal(favouriteStop(points,' '),null);
});
test('favourite stop distinguishes cancellation, passed stops and missing predictions', () => {
  const point = {name:'Hereford',scheduled:'12:30',expected:'12:35',passed:true};
  assert.equal(favouriteStop([point],'Hereford',true).state,'Cancelled');
  assert.equal(favouriteStop([point],'Hereford').state,'Already passed');
  assert.equal(favouriteStop([{...point,passed:false,expected:null}],'Hereford').state,'Prediction unavailable');
  assert.equal(favouriteStop([], 'Hereford').found,false);
});

import { recentStations } from '../src/storage.js';
test('recent station switching deduplicates CRS, keeps three stations and rejects malformed saved data', () => {
 const current={crs:'BMV',name:'Bromsgrove'};
 assert.deepEqual(recentStations(current, null),[current]);
 const result=recentStations(current,[{crs:'RDG',name:'Reading'},current,{crs:'WOF',name:'Worcester Foregate Street'},{crs:'HFD',name:'Hereford'},null]);
 assert.deepEqual(result.map(s=>s.crs),['BMV','RDG','WOF']);
 assert.deepEqual(recentStations({crs:'RDG',name:'Reading'},result).map(s=>s.crs),['RDG','BMV','WOF']);
 assert.deepEqual(recentStations(current,[{crs:'x',name:'Bad'},{crs:'HFD',name:''}]),[current]);
});
