import {applySocialEvents,managedQuests} from './social.js';
export const clone = value => structuredClone(value);
const plain = x => x && typeof x === 'object' && !Array.isArray(x);
const text = (x, max=200) => typeof x === 'string' && x.length <= max && !/[<>]/.test(x);
const name = x => text(x,80) && !/["'`\\]/.test(x);
const number = (x, max=1000000000) => Number.isFinite(x) && x >= 0 && x <= max;
export function validatePatch(patch) {
  if (!plain(patch)) throw Error('状态更新必须是 JSON 对象');
  const allowed=['gold','capacity','calendar','inventory','plots','relationships','locations','quests','animals','buildings','calendarEvents','notes'];
  for (const key of Object.keys(patch)) if (!allowed.includes(key)) throw Error('未知状态字段：'+key);
  if ('gold' in patch && !number(patch.gold)) throw Error('金币无效');
  if ('capacity' in patch && (!Number.isInteger(patch.capacity)||!number(patch.capacity,1000))) throw Error('背包容量无效');
  if ('calendar' in patch && (!plain(patch.calendar)||Object.entries(patch.calendar).some(([k,v])=>!['season','day','year','time','weather','weekday'].includes(k)|| !(text(v,40)||number(v,9999))))) throw Error('日历无效');
  for (const key of ['inventory','plots','quests','animals']) if (key in patch && (!Array.isArray(patch[key])||patch[key].length>500)) throw Error(key+' 数量无效');
  if (patch.inventory?.some(x=>!plain(x)||!name(x.name)||!x.name||!Number.isInteger(x.count)||!number(x.count,1000000)||!number(x.price??0)||!['item','seed','fertilizer'].includes(x.kind??'item')||!number(x.days??0,9999))) throw Error('背包物品无效');
  if (patch.plots?.some(x=>!plain(x)||!name(x.crop)||typeof x.wet!=='boolean'||!(x.days===null||number(x.days,9999))||!name(x.fertilizer??''))) throw Error('农田数据无效');
  if('buildings' in patch&&(!Array.isArray(patch.buildings)||patch.buildings.length>100))throw Error('建筑数据无效');
  if('calendarEvents' in patch&&(!Array.isArray(patch.calendarEvents)||patch.calendarEvents.length>100||patch.calendarEvents.some(x=>!plain(x)||!text(x.name,80)||!number(x.day,366)||!text(x.detail??'',2000)||!text(x.person??'',80))))throw Error('日历事件无效');
  for(const key of ['quests','buildings'])for(const item of patch[key]||[])for(const field of ['detail','goal','reward','deadline'])if(item[field]!==undefined&&!text(item[field],2000))throw Error('任务或建筑详情无效');
  for(const key of ['quests','animals','buildings']) if(patch[key]?.some(x=>!plain(x)||!text(x.name,80)||!text(x.status??'',300))) throw Error(key+' 内容无效');
  if ('relationships' in patch && (!plain(patch.relationships)||Object.entries(patch.relationships).some(([k,v])=>!/^\d{2}$/.test(k)||!number(v,2500)))) throw Error('好感度无效');
  if ('locations' in patch && (!plain(patch.locations)||Object.entries(patch.locations).some(([k,v])=>!/^\d{2}$/.test(k)||!plain(v)||!['west','center','north','south','east'].includes(v.region)||!number(v.x,100)||!number(v.y,100)))) throw Error('位置无效');
  if ('notes' in patch && !text(patch.notes,4000)) throw Error('笔记无效');
  // Reject hidden nested keys too; rebuild objects instead of merging arbitrary properties.
  const serialized=JSON.stringify(patch);
  if (/"(?:__proto__|constructor|prototype)"\s*:/.test(serialized)) throw Error('无效属性');
  return clone(patch);
}
export function applyPatch(state, patch) {
  patch=validatePatch(patch); const next=clone(state);
  for(const [k,v] of Object.entries(patch)) next[k]=['calendar','relationships','locations'].includes(k)?{...next[k],...v}:v;
  return next;
}
export function parseResult(raw) {
  const clean=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const result=JSON.parse(clean); if(!plain(result))throw Error('API 未返回 JSON 对象');
  if(!Object.hasOwn(result,'patch'))throw Error('API 缺少 patch 状态字段，未记录为同步成功，请重新提取');
  result.patch=validatePatch(result.patch);
  if(result.messages!==undefined && (!Array.isArray(result.messages)||result.messages.length>3||result.messages.some(x=>!plain(x)||!/^\d{2}$/.test(x.roleId)||!text(x.text,2000)))) throw Error('主动消息格式无效');
  return {patch:result.patch,messages:result.messages??[]};
}
export async function fingerprint(text) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
export function reconcile(store, signatures) {
  let keep=0;
  while(keep<store.turns.length && signatures[keep]===store.turns[keep].signature)keep++;
  if(keep<store.turns.length)store.turns.splice(keep);
  return keep;
}
export function world(store) {const turn=store.turns.at(-1),state=applySocialEvents(turn?.state??store.base,store.socialEvents||[],turn?.socialRevision??store.baseSocialRevision??0);if(store.mailQuests?.length){const managed=managedQuests(store);state.quests=[...(state.quests||[]).filter(q=>!q.mailQuestId&&!store.mailQuests.some(m=>m.subject===q.name)),...managed];}return state;}
export function migrateDemo(store,empty){
  if(store.version>=2)return false;
  const demo=store.base?.gold===12580&&store.base?.inventory?.some(x=>x.name==='防风草种子'&&x.count===12);
  if(demo){store.demoBackup=clone({base:store.base,turns:store.turns,draft:store.draft});const original=store.base;const clean=state=>{const next=clone(state);for(const [key,value] of Object.entries(empty)){if(!(key in next)||JSON.stringify(next[key])===JSON.stringify(original[key]))next[key]=clone(value);}return next;};store.base=clean(store.base);for(const t of store.turns)t.state=clean(t.state);store.draft=null;}
  store.version=2;store.needsRefresh=true;return true;
}
export function endpoint(input,allowHttp=false) {
  const u=new URL(input);
  if(!['http:','https:'].includes(u.protocol))throw Error('API 地址仅支持 HTTP 或 HTTPS');
  if(u.protocol==='http:'&&!allowHttp&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('这是 HTTP 接口，请在手机设置勾选“允许第三方 HTTP 接口”后保存');
  if(u.username||u.password||u.search||u.hash)throw Error('地址中不要包含密码、查询参数或 Key');
  return u.href.replace(/\/$/,'').replace(/(?:\/chat\/completions)?$/,'/chat/completions');
}
