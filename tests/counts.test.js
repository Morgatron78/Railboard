import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveProvider} from '../src/provider.js';
import {createMockBoard} from '../src/api.js';
import {validateSettings} from '../src/storage.js';
import {handleRequest} from '../worker/index.js';

test('larger boards persist and request the full count through the proxy for both directions', async () => {
  for(const count of [20,30]) for(const type of ['departures','arrivals']) {
    assert.equal(validateSettings({count}).count,count);
    assert.equal(createMockBoard({count,type}).services.length,count);
    const provider=createLiveProvider('https://proxy.test', async url => {
      const request=new Request(url,{headers:{Origin:'https://railboard.morgantech.co.uk'}});
      return handleRequest(request,{ALLOWED_ORIGINS:'https://railboard.morgantech.co.uk'}, {}, {fetch:async upstream=>{
        assert.equal(upstream.searchParams.get('limit'),String(count));
        assert.equal(upstream.pathname,`/boards/BMV/${type}`);
        return Response.json({crs:'BMV',name:'Bromsgrove',kind:type,departures:Array.from({length:count},()=>({public_dep:'1230',destination:'Test',status:'on_time'}))});
      }});
    });
    const board=await provider[type === 'arrivals' ? 'getArrivals' : 'getDepartures']({crs:'BMV',count});
    assert.equal(board.services.length,count);
  }
});
