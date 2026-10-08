import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarCropRect,moveAvatarCrop,openAvatarCrop} from './avatar-crop.js';

test('square crop fills portrait and landscape avatars without distortion or blank borders',()=>{
 assert.deepEqual(avatarCropRect(1200,600),{x:300,y:0,size:600,zoom:1});assert.deepEqual(avatarCropRect(600,1200),{x:0,y:300,size:600,zoom:1});assert.deepEqual(avatarCropRect(600,600),{x:0,y:0,size:600,zoom:1});
 for(const [w,h] of [[1,2000],[2000,1],[321,789],[789,321]])for(const zoom of [1,2,4,100,-1])for(const x of [-1,.5,2]){const r=avatarCropRect(w,h,{zoom,x,y:x});assert(r.x>=0&&r.y>=0&&r.x+r.size<=w&&r.y+r.size<=h);assert.equal(r.zoom,Math.min(4,Math.max(1,zoom)));}
 assert.throws(()=>avatarCropRect(0,20));assert.throws(()=>avatarCropRect(Infinity,20));
});
test('drag follows the image direction and accounts for the displayed phone scale',()=>{
 const state={zoom:2,x:.5,y:.5};const a=moveAvatarCrop(800,600,state,20,0,200),b=moveAvatarCrop(800,600,state,40,0,400);assert.deepEqual(a,b);assert.equal(avatarCropRect(800,600,a).x,220);
 const edge=avatarCropRect(800,600,moveAvatarCrop(800,600,state,10000,-10000,200));assert.equal(edge.x,0);assert.equal(edge.y,300);assert.deepEqual(state,{zoom:2,x:.5,y:.5});
});
function fixture(){
 const draws=[],nodes={};const node=()=>({listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},focus(){},getBoundingClientRect:()=>({width:240}),setPointerCapture(){}});
 for(const key of ['.jp-crop-stage canvas','.jp-crop-preview','input','[data-zoom-label]','[data-reset]','[data-cancel]','[data-confirm]','.jp-crop-error'])nodes[key]=node();
 for(const key of ['.jp-crop-stage canvas','.jp-crop-preview'])Object.assign(nodes[key],{width:key.includes('preview')?96:512,height:key.includes('preview')?96:512,getContext:()=>({clearRect(){},drawImage(...args){draws.push(args);}}),toDataURL:()=> 'data:image/png;base64,cropped'});
 const dialog=node();Object.assign(dialog,{isConnected:false,setAttribute(){},querySelector:s=>nodes[s],remove(){this.isConnected=false;}});
 const doc={createElement:tag=>tag==='img'?{naturalWidth:800,naturalHeight:600,decode:async()=>{}}:dialog};const screen={ownerDocument:doc,append(){dialog.isConnected=true;}};
 return {root:{querySelector:()=>screen},owner:{isConnected:true,querySelector:()=>node()},nodes,draws,dialog};
}
test('crop UI confirms square output, supports zoom/reset, and cancels without saving',async()=>{
 const original=globalThis.MutationObserver;globalThis.MutationObserver=class{observe(){}disconnect(){}};
 try{const f=fixture(),pending=openAvatarCrop({...f,source:'data:image/png;base64,original'});await Promise.resolve();await Promise.resolve();f.nodes.input.value='2';f.nodes.input.listeners.input();assert.equal(f.draws.at(-1)[3],300);f.nodes['[data-reset]'].onclick();assert.equal(f.draws.at(-1)[3],600);f.nodes['[data-confirm]'].onclick();assert.equal(await pending,'data:image/png;base64,cropped');assert.equal(f.dialog.isConnected,false);
 const canceled=fixture(),result=openAvatarCrop({...canceled,source:'data:image/gif;base64,original'});await Promise.resolve();await Promise.resolve();canceled.nodes['[data-cancel]'].onclick();assert.equal(await result,null);
 }finally{globalThis.MutationObserver=original;}
});
test('closing the plugin aborts a crop and remote URLs do not get fetched',async()=>{
 const original=globalThis.MutationObserver;globalThis.MutationObserver=class{observe(){}disconnect(){}};
 try{const f=fixture(),abort=new AbortController(),result=openAvatarCrop({...f,source:'data:image/webp;base64,original',signal:abort.signal});await Promise.resolve();await Promise.resolve();abort.abort();assert.equal(await result,null);assert.equal(f.dialog.isConnected,false);await assert.rejects(openAvatarCrop({...fixture(),source:'https://example.com/avatar.png'}));}finally{globalThis.MutationObserver=original;}
});
