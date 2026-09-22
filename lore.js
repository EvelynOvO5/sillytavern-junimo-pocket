export const EXPECTED_BOOK='⭐农民也要涩涩！';
export function resolveBinding(ctx,boundAvatar='') {
  if(ctx.groupId || ctx.characterId==null)throw Error('请打开月亮谷的单角色对话');
  const card=ctx.characters?.[ctx.characterId];
  const avatar=card?.avatar;
  if(!avatar)throw Error('当前角色卡尚未载入');
  if(boundAvatar && avatar!==boundAvatar)throw Error('手机仅绑定月亮谷角色卡，当前角色不读取世界书');
  const name=card.data?.extensions?.world;
  if(!name || (!boundAvatar && name!==EXPECTED_BOOK))throw Error('请把当前角色卡的主世界书绑定为「'+EXPECTED_BOOK+'」');
  return {name,avatar};
}
export async function readBoundLore(ctx,boundAvatar='',signal,fetcher=fetch) {
  const binding=resolveBinding(ctx,boundAvatar);
  const timeout=new AbortController();const stop=()=>timeout.abort();signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();const timer=setTimeout(stop,15000);
  try{
    // Read the linked book by name, never the editor selection or global/persona books.
    // Bypass ST's long-lived cache so edits from other tabs also appear next request.
    const response=await fetcher('/api/worldinfo/get',{method:'POST',headers:ctx.getRequestHeaders(),body:JSON.stringify({name:binding.name}),cache:'no-store',signal:timeout.signal});
    if(!response.ok)throw Error('世界书读取失败（HTTP '+response.status+'），本次不会发送角色请求');
    const book=await response.json();if(!book?.entries||typeof book.entries!=='object')throw Error('世界书内容格式不正确');
    return {...binding,entries:Object.values(book.entries)};
  }catch(e){if(e.name==='AbortError'&&!signal?.aborted)throw Error('读取世界书超时，请稍后重试');throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
}
export function selectLore(entries,{roleName='',narrative='',roles=[],budget=18000,user='用户',character='角色'}={}) {
  const query=(roleName+'\n'+narrative).toLowerCase();
  const targetNames=roleName==='维克多'?['维克多','维克托']:[roleName];
  const candidates=entries.filter(e=>e&&!e.disable&&e.enabled!==false&&typeof e.content==='string'&&e.content.trim()).filter(e=>!/(?:状态栏|\bcot\b|思维链|越狱)/i.test(e.comment||'')&&!/<(?:script|style|iframe)\b/i.test(e.content)).map(e=>{
    const title=String(e.comment||e.name||'');
    const keys=Array.isArray(e.key)?e.key:[];
    const direct=!!roleName&&targetNames.some(n=>title.includes(n)||keys.some(k=>String(k).includes(n)));
    const otherRole=roleName&&roles.some(r=>r.name!==roleName&&title.includes(r.name));
    const matched=keys.some(k=>typeof k==='string'&&k.length>0&&!k.startsWith('/')&&query.includes(k.toLowerCase()));
    const common=/世界观|规则|时间|地图|节日|任务|游戏|主要角色/.test(title);
    return {e,title,score:direct?100:otherRole?-1:common?50:matched?40:e.constant?20:-1};
  }).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||(Number(b.e.order)||0)-(Number(a.e.order)||0));
  let remaining=budget,trimmed=false;const selected=[];
  for(const {e,title} of candidates){if(remaining<100){trimmed=true;break;}let content=e.content.replace(/\{\{user\}\}/gi,()=>user).replace(/\{\{char\}\}/gi,()=>character);const max=Math.min(remaining,roleName&&title.includes(roleName)?10000:6000);if(content.length>max){content=content.slice(0,max)+'\n[此条目超出手机上下文限额]';trimmed=true;}selected.push({title,content});remaining-=content.length+title.length;}
  return {selected,trimmed,total:entries.filter(e=>e&&!e.disable&&e.enabled!==false).length};
}
