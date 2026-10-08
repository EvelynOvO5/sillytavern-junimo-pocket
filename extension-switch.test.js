import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPluginSwitch,mountExtensionSwitch} from './extension-switch.js';
import {watchStateBlocks} from './round-sync.js';

test('master switch preserves preferences and saves transitions only once',()=>{
 const settings={enabled:false,proactive:false,url:'saved',appPrompts:{style:'custom'}},snapshot=structuredClone(settings);let stops=0,starts=0,saves=0;
 const control=createPluginSwitch({settings:()=>settings,save:()=>saves++,stop:()=>{assert.equal(control.active(),false);stops++;},start:()=>{assert.equal(control.active(),true);starts++;}});
 assert.equal(control.active(),true);control.set(false);control.set(false);control.set(true);
 assert.deepEqual({...settings,pluginEnabled:undefined},{...snapshot,pluginEnabled:undefined});assert.equal(stops,1);assert.equal(starts,1);assert.equal(saves,2);
});

test('native settings checkbox reflects persisted disable and enables settings button immediately',()=>{
 const node=()=>({listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}}),input=node(),button=node(),status=node();let section,enabled=false,opened=0;
 const container={append(n){section=n;}},document={querySelector:()=>container,getElementById:()=>section,createElement:()=>({querySelector:s=>s.includes('enable')?input:s.includes('status')?status:button})};
 mountExtensionSwitch({document,active:()=>enabled,set:v=>enabled=v,openSettings:()=>opened++});assert.equal(input.checked,false);assert.equal(button.disabled,true);
 button.listeners.click();assert.equal(opened,0);input.checked=true;input.listeners.change();assert.equal(enabled,true);assert.equal(button.disabled,false);button.listeners.click();assert.equal(opened,1);
 assert.equal(mountExtensionSwitch({document,active:()=>enabled}),undefined);
});

test('stopping state hiding cancels queued observer callbacks and restores only owned DOM',()=>{
 const oldDocument=globalThis.document,oldObserver=globalThis.MutationObserver;let callback,observes=0,restored=0;const tag={hidden:true,dataset:{jpStateHidden:'true'}},span={childNodes:['original'],replaceWith(...nodes){assert.deepEqual(nodes,['original']);restored++;}};
 globalThis.document={body:{},querySelectorAll:s=>s==='[data-jp-sync-hidden]'?[span]:s==='[data-jp-state-hidden]'?[tag]:[]};globalThis.MutationObserver=class{constructor(fn){callback=fn;}observe(){observes++;}disconnect(){}};
 try{const watcher=watchStateBlocks();callback();watcher.disconnect();return new Promise(resolve=>queueMicrotask(()=>{try{assert.equal(observes,1);assert.equal(restored,1);assert.equal(tag.hidden,false);assert.equal(tag.dataset.jpStateHidden,undefined);resolve();}finally{globalThis.document=oldDocument;globalThis.MutationObserver=oldObserver;}}));}catch(e){globalThis.document=oldDocument;globalThis.MutationObserver=oldObserver;throw e;}
});

test('actual runtime disabled entry points do not read chat metadata, fetch, or schedule; disabling aborts all requests',async()=>{
 const settings={pluginEnabled:true,enabled:true},prompts=[],aborts=[],timers=[];let metadataReads=0,saves=0;
 const saved={version:3,turns:[],manual:[{id:'old',text:'保留气泡'}],unread:{},base:{calendar:{}}},snapshot=structuredClone(saved);
 const c={extensionSettings:{junimo_pocket_v1:settings},getCurrentChatId:()=> 'chat',chat:[],get chatMetadata(){metadataReads++;return {junimo_pocket_v1:saved};},eventTypes:{APP_READY:'ready'},eventSource:{on(){}},saveSettingsDebounced(){saves++;},setExtensionPrompt(...args){prompts.push(args);}};
 const fixture={settings,createPluginSwitch,SillyTavern:{getContext:()=>c},DOMException,AbortController,Set,console,clearTimeout(){},setTimeout(fn){timers.push(fn);},clone:structuredClone,storyKey:m=>m.mes,world:s=>s.base,syncAnimals:()=>false,discoverItems:()=>false,allPhoneMessages:s=>s.manual,allLetters:()=>[],resolveBinding(){},promptBaseline:()=>({initial:false}),statePrompt:()=> 'PHONE PROMPT',narrativeMemory:()=>'',messageEditGuidance:()=>'',publicMemory:()=>'',animalMemory:()=>'',actionMemory:()=>'',mailSyncInstruction:'',bootstrapPrompt:()=>'',offeringMemory:()=>'',birthdayMemory:()=>'',watchStateBlocks:()=>({disconnect(){}}),fetch(){throw Error('unexpected request');}};
 const source=readFileSync(new URL('./index.js',import.meta.url),'utf8').replace(/^import .*?;\r?\n/gm,'');
 vm.createContext(fixture);vm.runInContext(source+'\nglobalThis.hooks={masterSwitch,render,saveDraft,contentChanged,schedule,syncNarrative,installStatePrompt,completion,store,apiRequests,setup(){ui={roles:[],mapAnchors:[],clearTyping(){},closeRoom(){},home(){},update(){}};host={hidden:false,style:{removeProperty(key){delete this[key];}}};panel={hidden:false};badge={hidden:true,classList:{toggle(){}}};clamp=()=>{};stateWatcher={disconnect(){globalThis.watcherStopped=true;}};}};',fixture);
 const h=fixture.hooks;h.setup();h.apiRequests.add({abort(){aborts.push(1);}});h.masterSwitch.set(false);
 assert.equal(aborts.length,1);assert.equal(fixture.watcherStopped,true);assert.equal(prompts.at(-1)[1],'');assert.equal(saves,1);
 h.render();h.saveDraft({actions:['test']});h.contentChanged();h.schedule();await h.syncNarrative();h.installStatePrompt();assert.throws(()=>h.store(),{name:'AbortError'});await assert.rejects(h.completion([]),{name:'AbortError'});
 assert.equal(metadataReads,0);assert.equal(timers.length,0);assert.equal(settings.enabled,true);assert.deepEqual(saved,snapshot);h.masterSwitch.set(true);assert.equal(timers.length,1);assert.equal(prompts.at(-1)[1].startsWith('PHONE PROMPT'),true);assert.deepEqual(saved,snapshot);assert.equal(saves,2);
});
