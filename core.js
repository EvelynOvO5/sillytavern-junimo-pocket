export const clone = value => structuredClone(value);
const plain = x => x && typeof x === 'object' && !Array.isArray(x);
const text = (x, max=200) => typeof x === 'string' && x.length <= max && !/[<>]/.test(x);
const name = x => text(x,80) && !/["'`\\]/.test(x);
const number = (x, max=1000000000) => Number.isFinite(x) && x >= 0 && x <= max;
export function validatePatch(patch) {
  if (!plain(patch)) throw Error('状态更新必须是 JSON 对象');
  const allowed=['gold','capacity','calendar','inventory','plots','relationships','locations','quests','animals','notes'];
  for (const key of Object.keys(patch)) if (!allowed.includes(key)) throw Error('未知状态字段：'+key);
  if ('gold' in patch && !number(patch.gold)) throw Error('金币无效');
  if ('capacity' in patch && (!Number.isInteger(patch.capacity)||!number(patch.capacity,1000))) throw Error('背包容量无效');
  if ('calendar' in patch && (!plain(patch.calendar)||Object.entries(patch.calendar).some(([k,v])=>!['season','day','year','time','weather','weekday'].includes(k)|| !(text(v,40)||number(v,9999))))) throw Error('日历无效');
  for (const key of ['inventory','plots','quests','animals']) if (key in patch && (!Array.isArray(patch[key])||patch[key].length>500)) throw Error(key+' 数量无效');
  if (patch.inventory?.some(x=>!plain(x)||!name(x.name)||!x.name||!Number.isInteger(x.count)||!number(x.count,1000000)||!number(x.price??0)||!['item','seed','fertilizer'].includes(x.kind??'item')||!number(x.days??0,9999))) throw Error('背包物品无效');
  if (patch.plots?.some(x=>!plain(x)||!name(x.crop)||typeof x.wet!=='boolean'||!(x.days===null||number(x.days,9999))||!name(x.fertilizer??''))) throw Error('农田数据无效');
  for(const key of ['quests','animals']) if(patch[key]?.some(x=>!plain(x)||!text(x.name,80)||!text(x.status??'',300))) throw Error(key+' 内容无效');
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
  result.patch=validatePatch(result.patch??{});
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
export function world(store) {return clone(store.turns.at(-1)?.state??store.base);}
export function endpoint(input) {
  const u=new URL(input);
  if(u.protocol!=='https:' && !(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))) throw Error('API 请使用 HTTPS；本机接口可用 HTTP');
  if(u.username||u.password||u.search||u.hash)throw Error('地址中不要包含密码、查询参数或 Key');
  return u.href.replace(/\/$/,'').replace(/(?:\/chat\/completions)?$/,'/chat/completions');
}
