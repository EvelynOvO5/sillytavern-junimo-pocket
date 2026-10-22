// Lossless JSON graph storage with independent, lazily decoded rollback fields.
const FORMAT='junimo-pocket-compact',lazy=new WeakMap();
const forbidden=new Set(['__proto__','constructor','prototype']);
const writers=new WeakMap(),patchWriters=new WeakMap();
function writer(){return {nodes:[],seen:new Map(),imports:new Map(),stack:new WeakSet()};}
export function packSave(value,session=writer()){
 const {nodes,seen,imports,stack}=session;
 const intern=node=>{const text=JSON.stringify(node);let id=seen.get(text);if(id===undefined){id=nodes.length;nodes.push(node);seen.set(text,id);}return id;};
 function from(pool,id){let map=imports.get(pool);if(!map)imports.set(pool,map=new Map());if(map.has(id))return map.get(id);const n=pool[id],result=intern(Array.isArray(n)?[n[0],n[0]===0?n[1].map(i=>from(pool,i)):n[1].map(([k,i])=>[k,from(pool,i)])]:n);map.set(id,result);return result;}
 function encode(v){if(v===null||typeof v!=='object')return intern(v??null);if(stack.has(v))throw Error('手机存档包含循环引用');stack.add(v);let node;if(Array.isArray(v))node=[0,v.map(encode)];else{const meta=lazy.get(v);node=[1,Object.keys(v).filter(k=>meta?.refs.has(k)&&!meta.loaded.has(k)&&typeof Object.getOwnPropertyDescriptor(v,k)?.get==='function'||v[k]!==undefined).map(k=>{if(forbidden.has(k))throw Error('无效存档属性');return [k,meta?.refs.has(k)&&!meta.loaded.has(k)&&typeof Object.getOwnPropertyDescriptor(v,k)?.get==='function'?from(meta.pool,meta.refs.get(k)):encode(v[k])];})];}stack.delete(v);return intern(node);}
 const root=encode(value);return {format:FORMAT,version:3,codecVersion:1,root,nodes};
}
export function unpackSave(data,{lazySnapshots=true,trusted=false}={}){
 if(data?.format!==FORMAT)return data;
 const pool=data.nodes;
 if(data.version!==3||data.codecVersion!==1||!Array.isArray(pool)||pool.length>2000000||!Number.isInteger(data.root)||data.root<0||data.root>=pool.length)throw Error('压缩手机存档格式无效');
 if(!trusted)for(let id=0;id<pool.length;id++){const n=pool[id];if(n===null||['string','number','boolean'].includes(typeof n))continue;if(!Array.isArray(n)||n.length!==2||![0,1].includes(n[0])||!Array.isArray(n[1]))throw Error('压缩手机存档节点无效');const keys=new Set();for(const row of n[1]){const ref=n[0]===0?row:row?.[1];if(n[0]===1&&(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||forbidden.has(row[0])||keys.has(row[0])))throw Error('无效存档属性');if(n[0]===1)keys.add(row[0]);if(!Number.isInteger(ref)||ref<0||ref>=id)throw Error('压缩手机存档引用无效');}}
 function decode(id,key='',depth=0,budget={left:2000000}){if(--budget.left<0)throw Error('手机存档展开过大');if(depth>150)throw Error('手机存档嵌套过深');const n=pool[id];if(!Array.isArray(n))return n;if(n[0]===0)return n[1].map(i=>decode(i,'',depth+1,budget));const out={};if(lazySnapshots&&key==='before'){const meta={pool,refs:new Map(n[1]),loaded:new Map()};lazy.set(out,meta);for(const [k,i]of n[1])Object.defineProperty(out,k,{enumerable:true,configurable:true,get(){if(!meta.loaded.has(k))meta.loaded.set(k,decode(i,k,depth+1));return meta.loaded.get(k);},set(v){meta.loaded.set(k,v);}});}else for(const [k,i]of n[1])out[k]=decode(i,k,depth+1,budget);return out;}
 const result=decode(data.root);if(!result||typeof result!=='object'||Array.isArray(result))throw Error('手机存档根节点无效');return result;
}
export function snapshotFieldLoaded(snapshot,key){return lazy.get(snapshot)?.loaded.has(key)??true;}

const live=new WeakSet(),repackRequested=new WeakSet();
export function requestSaveCompaction(s){repackRequested.add(s);}
export function needsSaveCompaction(s){return !!s&&repackRequested.has(s); }
export function isPackedSave(s){return s?.format===FORMAT;}
export function compactClone(s){return unpackSave(packSave(s),{trusted:true});}
export function compactCheckpoint(s,keys,values=s){let session=writers.get(s);if(!session)writers.set(s,session=writer());return unpackSave(packSave({before:Object.fromEntries(keys.map(k=>[k,values[k]??null]))},session),{trusted:true}).before;}
export function withCheckpointFields(before,patch){const meta=lazy.get(before);let session=meta&&patchWriters.get(meta.pool);if(!session){session=writer();if(meta)patchWriters.set(meta.pool,session);}const next=unpackSave(packSave({before},session),{trusted:true}).before;Object.assign(next,structuredClone(patch));return next;}
export function prepareCompactStore(s,{allowMigration=true}={}){if(isPackedSave(s)){const result=unpackSave(s);attach(result);return result;}if(allowMigration&&repackRequested.has(s)){const result=compactClone(s);attach(result);return result;}if(!allowMigration||live.has(s)||(!s.candidateProgress&&(s?.turns?.length||0)<100))return s;const result=compactClone(s);attach(result);return result;}
function attach(s){Object.defineProperty(s,'toJSON',{configurable:true,enumerable:false,value(){return packSave(this);}});live.add(s);return s;}

// Cooperative first conversion: yield between small batches so feedback can paint.
export function isCompactStore(s){return live.has(s)||isPackedSave(s);}
export async function optimizeCompactStore(source,{pause=()=>new Promise(resolve=>setTimeout(resolve,0)),check=()=>{},progress=()=>{}}={}){
 const session=writer(),memo=new WeakMap(),ancestors=new WeakSet();let steps=0,total=0,last=Date.now(),root;
 const intern=node=>{const text=JSON.stringify(node);let id=session.seen.get(text);if(id===undefined){id=session.nodes.length;session.nodes.push(node);session.seen.set(text,id);}return id;};
 const frames=[{value:source,done:id=>root=id}];
 await pause();check();
 while(frames.length){const f=frames.at(-1),v=f.value;
  if(!f.keys){if(v===null||typeof v!=='object'){f.done(intern(v??null));frames.pop();}
   else if(ancestors.has(v))throw Error('手机存档包含循环引用');
   else if(memo.has(v)){f.done(memo.get(v));frames.pop();}
   else if(lazy.has(v)){const id=packSave(v,session).root;memo.set(v,id);f.done(id);frames.pop();}
   else{ancestors.add(v);f.array=Array.isArray(v);f.keys=f.array?Array.from({length:v.length},(_,i)=>i):Object.keys(v).filter(k=>v[k]!==undefined);f.rows=[];f.index=0;}
  }else if(f.index<f.keys.length){const key=f.keys[f.index++];if(!f.array&&forbidden.has(key))throw Error('无效存档属性');frames.push({value:v[key],done:id=>f.rows.push(f.array?id:[key,id])});}
  else{const id=intern([f.array?0:1,f.rows]);memo.set(v,id);ancestors.delete(v);f.done(id);frames.pop();}
  total++;if(++steps>=2048){steps=0;if(Date.now()-last>=8){progress(total);await pause();check();last=Date.now();}}
 }
 check();progress(total);await pause();check();
 const result=unpackSave({format:FORMAT,version:3,codecVersion:1,root,nodes:session.nodes},{trusted:true});attach(result);return result;
}
