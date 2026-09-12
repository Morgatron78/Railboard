import test from 'node:test';
import assert from 'node:assert/strict';
import {watchUpdates} from '../src/updates.js';
import {journeyProgress} from '../src/detail.js';

test('updates wait for explicit action and do not interrupt open sheets', () => {
  const target = () => { const handlers={}; return {addEventListener:(name,fn)=>handlers[name]=fn, fire:name=>handlers[name]?.()}; };
  const registration=target(), button=target(), serviceWorker=target(), documentRef=target();
  let open=false, render, messages=0, reloads=0;
  documentRef.querySelector=()=>open;
  documentRef.querySelectorAll=()=>[{}];
  watchUpdates(registration,{button,serviceWorker,documentRef,reload:()=>reloads++,Observer:class{constructor(fn){render=fn;} observe(){}}});
  assert.equal(button.hidden,true);
  registration.waiting={postMessage:message=>{assert.equal(message.type,'ACTIVATE_UPDATE');messages++;}};
  render(); assert.equal(button.hidden,false);
  serviceWorker.fire('controllerchange'); assert.equal(reloads,0);
  open=true; render(); assert.equal(button.hidden,true);
  button.fire('click'); assert.equal(messages,0);
  open=false; render(); button.fire('click'); assert.equal(messages,1);
  assert.equal(button.disabled,true);
  serviceWorker.fire('controllerchange'); assert.equal(reloads,1);
});

test('journey completion requires reported passage, not scheduled time', () => {
  assert.equal(journeyProgress([]),'');
  assert.equal(journeyProgress([{here:true,scheduled:'00:01'}]),'');
  assert.equal(journeyProgress([{here:true,passed:true},{passed:false}]),'Departed selected station');
  assert.equal(journeyProgress([{passed:true},{status:'departed'}]),'Journey complete');
  assert.equal(journeyProgress([{status:'cancelled'}]),'');
});
