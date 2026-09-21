import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPatch,parseResult,validatePatch,endpoint,reconcile,world,fingerprint} from './core.js';
const base={gold:10,calendar:{day:1,season:'春'},inventory:[],plots:[],relationships:{},locations:{}};
test('absolute updates never double count and preserve unchanged calendar fields',()=>{const patch={gold:15,calendar:{day:2}};const once=applyPatch(base,patch);assert.deepEqual(applyPatch(once,patch),once);assert.equal(once.calendar.season,'春');assert.equal(base.gold,10);});
test('arrays replace completely including empty inventory',()=>assert.deepEqual(applyPatch({...base,inventory:[{name:'土豆',count:1}]},{inventory:[]}).inventory,[]));
test('reject malformed, negative, unknown and hostile values',()=>{for(const p of [{gold:-1},{gold:'12'},{other:1},{inventory:[{name:'<img>',count:2}]},{plots:[{crop:'a',wet:true,days:-1}]},JSON.parse('{"locations":{"01":{"region":"west","x":2,"y":3,"__proto__":{}}}}')])assert.throws(()=>validatePatch(p));});
test('strict JSON result parsing and phone message validation',()=>{assert.equal(parseResult('```json\n{"patch":{"gold":3},"messages":[]}\n```').patch.gold,3);assert.throws(()=>parseResult('{"messages":[{"roleId":"01","text":"<script>"}]}'));assert.throws(()=>parseResult('Here is JSON: {}'));});
test('edit/delete rollback clears affected snapshots and proactive messages',()=>{const s={base,turns:[{signature:'a',state:{...base,gold:20},messages:[]},{signature:'b',state:{...base,gold:50},messages:[{text:'stale'}]}]};assert.equal(reconcile(s,['a','c']),1);assert.equal(world(s).gold,20);reconcile(s,[]);assert.equal(world(s).gold,10);});
test('secure endpoint normalization',()=>{assert.equal(endpoint('https://example.com/v1/'),'https://example.com/v1/chat/completions');assert.equal(endpoint('http://localhost:1234/v1/chat/completions'),'http://localhost:1234/v1/chat/completions');for(const x of ['http://remote.com','https://x.com/?key=secret','https://user:pw@x.com','javascript:alert(1)'])assert.throws(()=>endpoint(x));});
test('signatures are stable and distinguish swipes',async()=>{assert.equal(await fingerprint('a'),await fingerprint('a'));assert.notEqual(await fingerprint('a'),await fingerprint('b'));});

