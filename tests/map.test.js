import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrainMap, expandableMap} from '../src/map.js';

function mockLibrary() {
  const state = {maps:0, removed:0, positions:[]};
  return {state, gl:{
    Map:class {constructor(options){state.maps++;state.options=options;} addControl(){} on(){} remove(){state.removed++;}},
    Marker:class {setLngLat(position){state.positions.push(position);return this;} addTo(){return this;} remove(){}},
    NavigationControl:class {}
  }};
}
test('train map updates the marker without recreating the camera and releases resources', async () => {
  const {gl,state}=mockLibrary();
  const map=createTrainMap({load:async()=>gl});
  await map.show({}, {lat:52,lon:-2},()=>{});
  await map.show({}, {lat:53,lon:-1},()=>{});
  assert.equal(state.maps,1);
  assert.deepEqual(state.positions,[[-2,52],[-1,53]]);
  assert.equal(state.options.attributionControl,true);
  map.destroy(); assert.equal(state.removed,1);
  map.destroy(); assert.equal(state.removed,1);
});
test('map expansion returns within the same dialog and Escape collapses before closing', () => {
  const handlers = {}, classes = new Set(); let resizes = 0, focused = 0;
  const button = {setAttribute(key,value){this[key]=value;},focus(){focused++;}};
  const dialog = {classList:{toggle(key,on){on?classes.add(key):classes.delete(key);},contains:key=>classes.has(key),remove:key=>classes.delete(key)},
    addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener:key=>delete handlers[key]};
  const panel = {querySelector:()=>button,addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener:key=>delete handlers[key]};
  const expansion = expandableMap(dialog,panel,()=>resizes++);
  const click = () => handlers.click({target:{closest:()=>button}});
  click(); assert.equal(button['aria-expanded'],'true'); assert.equal(button.textContent,'Back to service details');
  let prevented=false; handlers.cancel({preventDefault(){prevented=true;}});
  assert.equal(prevented,true); assert.equal(button['aria-expanded'],'false');
  handlers.cancel({preventDefault(){assert.fail('normal dialog close must remain available');}});
  click(); expansion.reset(); assert.equal(classes.size,0); assert.equal(resizes,4); assert.equal(focused,4);
  expansion.dispose(); assert.deepEqual(handlers,{});
});
test('closing during library loading prevents a late map from being created', async () => {
  const {gl,state}=mockLibrary(); let resolve;
  const map=createTrainMap({load:()=>new Promise(done=>resolve=done)});
  const pending=map.show({}, {lat:52,lon:-2},()=>{});
  map.destroy(); resolve(gl); await pending;
  assert.equal(state.maps,0);
});
test('library failure is reported to the caller and can be retried', async () => {
  const {gl,state}=mockLibrary(); let fail=true;
  const map=createTrainMap({load:async()=>{if(fail)throw Error('offline');return gl;}});
  await assert.rejects(map.show({}, {lat:52,lon:-2},()=>{}),/offline/);
  fail=false; await map.show({}, {lat:52,lon:-2},()=>{});
  assert.equal(state.maps,1); map.destroy();
});
