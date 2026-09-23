import {readStateBlock,statePrompt,parseBubbles} from './protocol.js';
import {mountPhone} from './phone.js';
import {readBoundLore,resolveBinding,selectLore} from './lore.js';
import {clone,applyPatch,validatePatch,parseResult,fingerprint,reconcile,world,endpoint,migrateDemo} from './core.js';
const KEY='junimo_pocket_v1';
const context=()=>globalThis.SillyTavern.getContext();
const defaults={enabled:true,proactive:true,allowHttp:false,url:'',model:'',maxChars:12000,history:16,maxTokens:2200,loreChars:18000,boundAvatar:'',left:null,top:70};
let ui,host,panel,badge,statusLine,settingsPanel,sessionKey='',generation=false,epoch=0,controller=null,working=false,pending=false,timer,booted=false,phoneOpen=false,storeRef;
const config=()=>context().extensionSettings[KEY]??(context().extensionSettings[KEY]=clone(defaults));
const currentId=()=>String(context().getCurrentChatId?.()??context().chatId??'');
function store(){if(!currentId())throw Error('请先打开一段角色对话');const s=context().chatMetadata[KEY]??(context().chatMetadata[KEY]={version:3,base:clone(ui.initial),turns:[],manual:[],unread:{},draft:null});if(s.version<3){s.legacyBackup=clone({base:s.base,turns:s.turns,manual:s.manual});s.version=3;s.base=clone(ui.initial);s.turns=[];s.started=false;s.draft=null;context().saveMetadataDebounced?.();}return s;}
function status(text){if(statusLine)statusLine.textContent=text;ui?.setStatus(text);}
function error(e){if(e.name==='AbortError')return;status('未完成：'+e.message);ui?.toast(e.message);}
async function apiFailure(response,key=''){
  let detail='';try{const body=await response.json();detail=body.error?.message||body.message||'';}catch{}
  if(typeof detail!=='string')detail='';if(key)detail=detail.split(key).join('[Key 已隐藏]');
  const hint=response.status===503?'当前服务或模型渠道暂不可用，请切换模型渠道或稍后重试':response.status===401?'Key 无效或已过期':response.status===429?'请求受限或额度不足':'请检查接口地址和模型';
  return Error('API 返回 HTTP '+response.status+'；'+hint+(detail?'。服务商：'+detail.slice(0,350):''));
}
async function persist(){const c=context();await c.saveMetadata();}
function threads(s){const all=[...s.manual,...s.turns.flatMap(t=>t.messages||[])].sort((a,b)=>a.created-b.created);const out={};for(const m of all)(out[m.roleId]??=[]).push(m);return out;}
function render(){try{const s=store();ui.update(world(s),threads(s),s.unread,s.draft);badge.classList.toggle('unread',Object.values(s.unread).some(Boolean));}catch{ui.update(ui.initial,{},{});}}
function saveDraft(draft){if(!currentId())return;const s=store();s.draft=draft.actions.length?draft:null;context().saveMetadataDebounced?.();}
function compose(text){const input=document.querySelector('#send_textarea');if(!input)throw Error('找不到酒馆输入框');input.value=(input.value?input.value+'\n':'')+text;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}
function extractNarrative(raw){let text=String(raw||'');if(/<(?:html|body|div|p|style|script)\b/i.test(text)){const doc=new DOMParser().parseFromString(text,'text/html');doc.querySelectorAll('script,style,svg').forEach(el=>el.remove());doc.querySelectorAll('p,div,br,tr,li').forEach(el=>el.append('\n'));text=doc.body.textContent||text;}const limit=config().maxChars;return text.length<=limit?text:text.slice(0,Math.floor(limit*.4))+'\n[中段超出正文长度上限]\n'+text.slice(-Math.floor(limit*.6));}
function recentNarrative(limit=config().maxChars){return context().chat.filter(m=>!m.is_system).slice(-8).map(m=>(m.is_user?'用户':'正文')+'：'+m.mes).join('\n').slice(-limit);}
async function roleContext(roleName='',narrative='',signal){const c=context(),cfg=config(),run=epoch;const book=await readBoundLore(c,cfg.boundAvatar,signal);if(run!==epoch)throw new DOMException('对话已变化','AbortError');if(!cfg.boundAvatar){cfg.boundAvatar=book.avatar;c.saveSettingsDebounced();}const result=selectLore(book.entries,{roleName,narrative,roles:ui.roles,budget:cfg.loreChars,user:c.name1,character:c.name2});if(!result.selected.length)throw Error('绑定世界书中没有可用的人设或世界规则条目');ui.setLoreStatus('已连接：'+book.name+' · 本次选取 '+result.selected.length+' / '+result.total+' 条'+(result.trimmed?'（部分内容受长度限制）':''));return JSON.stringify({user:c.name1,character:c.name2,worldbook:book.name,entries:result.selected});}
async function completion(messages,signal){
  const cfg=config();if(!cfg.url||!cfg.model||!sessionKey)throw Error('请先在手机设置填写 API 地址、模型和本次会话 Key');
  const url=endpoint(cfg.url,cfg.allowHttp);if(location.protocol==='https:'&&url.startsWith('http:'))throw Error('当前酒馆使用 HTTPS，浏览器可能阻止 HTTP 接口。请使用服务商的 HTTPS 地址或自行配置 HTTPS 反向代理。');const timeout=new AbortController();const forward=()=>timeout.abort();signal?.addEventListener('abort',forward,{once:true});if(signal?.aborted)timeout.abort();const id=setTimeout(()=>timeout.abort(),90000);
  try{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+sessionKey},body:JSON.stringify({model:cfg.model,messages,stream:false,max_tokens:cfg.maxTokens,temperature:0.5}),signal:timeout.signal,credentials:'omit',redirect:'error'});if(!response.ok)throw await apiFailure(response,sessionKey);const data=await response.json();if(data.choices?.[0]?.finish_reason==='length')throw Error('回复被截断，请增加输出上限或缩小状态');const text=data.choices?.[0]?.message?.content;if(typeof text!=='string'||!text.trim())throw Error('API 返回了空回复');return text;}catch(e){if(e.name==='TypeError')throw Error('无法连接 API（网络或 CORS 限制）。服务商需允许酒馆网页跨域访问。');if(e.name==='AbortError'&&!signal?.aborted)throw Error('API 请求超时，未改动状态');throw e;}finally{clearTimeout(id);signal?.removeEventListener('abort',forward);}
}

function installStatePrompt(){const c=context();try{resolveBinding(c,config().boundAvatar);const state=currentId()?world(store()):ui.initial;c.setExtensionPrompt?.('junimo_pocket_state',config().enabled?statePrompt(state,ui.roles,ui.mapAnchors,!store().turns.some(t=>t.hasState)):'',1,0,false,0);}catch{c.setExtensionPrompt?.('junimo_pocket_state','',1,0,false,0);}}
async function signatures(){return Promise.all(context().chat.map(async(m,index)=>({index,message:m,signature:await fingerprint(JSON.stringify([m.is_user,m.is_system,m.name,m.mes,m.swipe_id]))})));}
async function proactive(s,turn,narrative,signal,run){
 if(!config().proactive||turn.phoneDone||!sessionKey||!config().url)return;
 try{const background=await roleContext('',narrative,signal);const raw=await completion([{role:'system',content:'你是手机聊天消息调度员。角色正在用手机给用户发消息，不是面对面说话。依据本轮正文与人设，最多让两位有合理联系理由的角色发消息。每人可发1到4个短气泡，口吻自然随意；禁止旁白、动作、替用户说话。没有理由则messages为空。只能返回JSON：{"messages":[{"roleId":"01","bubbles":["短消息","补充一句"]}]}。不要修改世界状态。'},{role:'user',content:JSON.stringify({roles:ui.roles,background,narrative,recentPhoneMessages:Object.fromEntries(Object.entries(threads(s)).map(([k,v])=>[k,v.slice(-4)])),state:world(s)})}],signal);
 const result=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));if(!Array.isArray(result.messages)||result.messages.length>2)throw Error('主动消息格式无效');
 const incoming=[];for(const item of result.messages){if(!ui.roles.some(r=>r.id===item.roleId))throw Error('主动消息角色无效');for(const text of parseBubbles(JSON.stringify({bubbles:item.bubbles})))incoming.push({roleId:item.roleId,text,from:'role',created:Date.now()+incoming.length,time:world(s).calendar.time});}
 if(run!==epoch)return;turn.phoneDone=true;for(const m of incoming){if(run!==epoch)return;turn.messages.push(m);s.unread[m.roleId]=true;render();await persist();await new Promise(r=>setTimeout(r,450));}if(incoming.length)ui.notify('收到 '+incoming.length+' 条手机消息');
 }catch(e){if(e.name!=='AbortError'){turn.phoneError=e.message;status('变量已更新；主动消息未完成：'+e.message);}}
}
async function syncNarrative(forceLatest=false){
 if(working){pending=true;return;}if(!currentId()||generation)return;working=true;pending=false;const run=epoch,id=currentId();controller=new AbortController();
 try{const s=store(),rows=await signatures();if(run!==epoch)return;let keep=reconcile(s,rows.map(r=>r.signature));if(!config().enabled&&!forceLatest){installStatePrompt();return;}resolveBinding(context(),config().boundAvatar);
 if(!s.started){const last=rows.findLastIndex(r=>!r.message.is_user&&!r.message.is_system);for(let i=0;i<Math.max(last,0);i++)s.turns.push({signature:rows[i].signature,state:clone(s.base),messages:[],hasState:false});s.started=true;keep=s.turns.length;}
 if(forceLatest){const last=rows.findLastIndex(r=>!r.message.is_user&&!r.message.is_system);if(last>=0){s.turns.splice(last);keep=last;}}
 for(let i=keep;i<rows.length;i++){
   if(run!==epoch||id!==currentId()||generation)return;const {message:m,signature}=rows[i];let state=world(s),hasState=false,changed=[];
   if(!m.is_user&&!m.is_system&&m.mes?.trim()){
     const parsed=readStateBlock(m.mes,state,{roles:ui.roles,initial:!s.turns.some(t=>t.hasState)});
     if(parsed){state=parsed.state;changed=Object.keys(parsed.patch);hasState=true;}else status('本轮正文缺少变量块：请重新生成，手机不会猜测数值');
   }
   const turn={signature,state,messages:[],hasState};s.turns.push(turn);if(hasState){s.draft=null;delete s.needsRefresh;}
   render();await persist();installStatePrompt();
   if(hasState){const names={gold:'金币',calendar:'日历',inventory:'背包',plots:'农田',locations:'地图',quests:'任务',calendarEvents:'日程',animals:'动物',buildings:'建筑',relationships:'好感度',notes:'农场记录'};status('正文变量已更新：'+(changed.map(k=>names[k]||k).join('、')||'本轮无变化'));await proactive(s,turn,extractNarrative(m.mes.split('<junimo-state>')[0]),controller.signal,run);}
 }
 }catch(e){error(e);}finally{working=false;controller=null;if(pending){pending=false;schedule();}}
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>syncNarrative(),600);}
function invalidate(){epoch++;controller?.abort();pending=true;}

async function queueBubble(role,text){if(!text.trim())return;if(text.length>4000)throw Error('单条手机消息请控制在4000字以内');const s=store();s.manual.push({id:crypto.randomUUID(),roleId:role.id,from:'me',text:text.trim(),created:Date.now(),time:world(s).calendar.time,status:'queued'});render();await persist();}
async function send(role,text=''){
 if(text.trim())await queueBubble(role,text);if(working)throw Error('正在处理手机消息，请稍后点击真正发送');
 const s=store(),run=epoch,id=currentId(),cfg=config();const queued=s.manual.filter(m=>m.roleId===role.id&&m.from==='me'&&['queued','failed'].includes(m.status));if(!queued.length)throw Error('请先虚拟发送一条消息');
 working=true;controller=new AbortController();queued.forEach(m=>m.status='sending');render();status(role.name+' 正在输入…');
 try{const all=threads(s)[role.id]||[];const limit=queued.at(-1).created;const messages=all.filter(m=>m.created<=limit).slice(-Math.max(cfg.history||0,queued.length)).map(m=>({role:m.from==='me'?'user':'assistant',content:m.text}));const narrative=recentNarrative();const background=await roleContext(role.name,queued.map(m=>m.text).join('\n'),controller.signal);
 const response=await completion([{role:'system',content:'你是'+role.name+'，正在手机聊天App里和用户文字聊天。双方可能不在同一个地方。保持世界书人设，不写旁白、动作描写，不替用户说话；只能知道自己有理由知道的事情。阅读用户连续发来的全部气泡后一起回复。像真人打字，可随意分成1至6条短消息，长短不一，不要每次一大段，不必机械问句收尾。仅返回严格JSON：{"bubbles":["第一条","再补充一句"]}。世界书资料：'+background+'\n当前正文：'+narrative},...messages],controller.signal);
 const bubbles=parseBubbles(response);if(run!==epoch||id!==currentId())throw new DOMException('对话已切换','AbortError');queued.forEach(m=>m.status='sent');
 for(const text of bubbles){if(run!==epoch)break;s.manual.push({id:crypto.randomUUID(),roleId:role.id,from:'role',text,created:Date.now(),time:world(s).calendar.time});render();await persist();await new Promise(r=>setTimeout(r,Math.min(1000,250+text.length*15)));}status('手机消息已保存');
 }catch(e){queued.forEach(m=>{if(m.status==='sending')m.status='failed';});if(run===epoch){render();await persist();}throw e;}finally{working=false;controller=null;if(pending){pending=false;schedule();}}
}
function field(label,type,value){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=value??'';wrap.append(input);settingsPanel.append(wrap);return input;}
function button(label,callback){const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=async()=>{b.disabled=true;try{await callback();}catch(e){error(e);}finally{b.disabled=false;}};settingsPanel.append(b);return b;}
function openSettings(){
  settingsPanel.replaceChildren();ui.showSettings();const cfg=config();const heading=document.createElement('h3');heading.textContent='连接与同步';settingsPanel.append(heading);
  const help=document.createElement('p');help.textContent='正文变量直接读取末尾的 junimo-state 块，不消耗独立 API。独立 API 仅用于手机私聊和主动消息。保存 API 预设后，地址、Key 和模型会保存在本机此浏览器，刷新后可继续使用；不会包含在聊天存档导出中。HTTP 会明文传输 Key 和聊天内容。';settingsPanel.append(help);
  const loreInfo=document.createElement('p');loreInfo.className='jp-lore-info';settingsPanel.append(loreInfo);try{loreInfo.textContent='绑定世界书：'+resolveBinding(context(),cfg.boundAvatar).name+' · 每次请求前重新读取';}catch(e){loreInfo.textContent=e.message;}
  const presetStore='junimo_pocket_api_presets_v1';let saved={items:[],active:''};try{const value=JSON.parse(localStorage.getItem(presetStore)||'null');if(Array.isArray(value?.items))saved=value;}catch{}
  const selectField=label=>{const wrap=document.createElement('label');wrap.textContent=label;const el=document.createElement('select');el.style.cssText='display:block;width:100%;padding:8px;border-radius:10px;';wrap.append(el);settingsPanel.append(wrap);return el;};
  const preset=selectField('已保存的 API 预设');const presetName=field('预设名称','text','');
  function refreshPresets(){preset.replaceChildren(new Option('选择预设…',''));for(const p of saved.items)preset.add(new Option(p.name,p.id));preset.value=saved.active||'';presetName.value=saved.items.find(p=>p.id===saved.active)?.name||'';}refreshPresets();
  const url=field('API 基础地址（含 /v1，或完整 /chat/completions）','url',cfg.url),model=field('模型名称','text',cfg.model),key=field('API Key','password',sessionKey);key.autocomplete='off';
  const allowHttp=field('允许第三方 HTTP 接口（Key 和聊天内容将明文传输）','checkbox','');allowHttp.checked=!!cfg.allowHttp;
  const models=selectField('可用模型（保留服务商完整渠道名称）');models.add(new Option('点击下方拉取模型；也可手填模型名称',''));models.onchange=()=>{if(models.value)model.value=models.value;};
  let modelRequest=0;function clearModels(){modelRequest++;models.replaceChildren(new Option('地址或 Key 已变化，请重新拉取模型',''));}url.addEventListener('input',clearModels);key.addEventListener('input',clearModels);
  button('拉取模型',async()=>{const base=endpoint(url.value.trim(),allowHttp.checked).replace(/\/chat\/completions$/,'/models');const token=key.value.trim();if(!token)throw Error('请先填写 API Key');const run=++modelRequest;const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);try{status('正在拉取模型…');const response=await fetch(base,{headers:{Authorization:'Bearer '+token},credentials:'omit',redirect:'error',signal:abort.signal});if(!response.ok)throw await apiFailure(response,token);const data=await response.json();const ids=[...new Set((Array.isArray(data.data)?data.data:Array.isArray(data)?data:[]).map(x=>typeof x==='string'?x:x?.id).filter(x=>typeof x==='string'&&x.trim()))];if(run!==modelRequest||!models.isConnected)return;if(!ids.length)throw Error('接口未返回模型列表，请手动填写服务商的完整模型名称');models.replaceChildren(new Option('请选择模型',''));for(const id of ids)models.add(new Option(id,id));models.value=ids.includes(model.value)?model.value:'';status('已拉取 '+ids.length+' 个模型，请选择渠道后保存');}catch(e){if(e.name==='AbortError')throw Error('拉取模型超时');if(e.name==='TypeError')throw Error('无法拉取模型，请检查网络及服务商跨域设置');throw e;}finally{clearTimeout(timer);}});
  function writePresets(){localStorage.setItem(presetStore,JSON.stringify(saved));}
  preset.onchange=()=>{const p=saved.items.find(x=>x.id===preset.value);if(!p)return;invalidate();url.value=p.url;model.value=p.model;key.value=p.key;allowHttp.checked=!!p.allowHttp;presetName.value=p.name;clearModels();Object.assign(cfg,{url:p.url,model:p.model,allowHttp:!!p.allowHttp});sessionKey=p.key;saved.active=p.id;writePresets();context().saveSettingsDebounced();status('已切换 API 预设：'+p.name);};
  button('保存 API 预设',async()=>{const name=presetName.value.trim();if(!name)throw Error('请填写预设名称');if(!key.value.trim())throw Error('请填写 API Key');await save();const existing=saved.items.find(p=>p.name===name);const p={id:existing?.id||crypto.randomUUID(),name,url:cfg.url,model:cfg.model,key:sessionKey,allowHttp:!!cfg.allowHttp};saved.items=saved.items.filter(x=>x.id!==p.id);saved.items.push(p);saved.active=p.id;writePresets();refreshPresets();status('API 预设已保存，下次打开会自动恢复');});
  const enabled=field('正文变量同步','checkbox','');enabled.checked=cfg.enabled;const proactive=field('允许角色随正文主动发消息','checkbox','');proactive.checked=cfg.proactive;
  const chars=field('单轮正文最多携带字符','number',cfg.maxChars),history=field('手机上下文消息条数','number',cfg.history),tokens=field('单次输出 token 上限','number',cfg.maxTokens);
  const loreChars=field('世界书内容上限（字符）','number',cfg.loreChars);
  button('检查世界书连接',async()=>{await roleContext('',recentNarrative());status('世界书已读取，下次请求自动使用最新内容');});
  async function save(){if(url.value.trim())endpoint(url.value.trim(),allowHttp.checked);if(url.value.trim()&&!model.value.trim())throw Error('请填写模型');for(const [input,min,max] of [[chars,1000,40000],[history,0,60],[tokens,300,12000],[loreChars,2000,40000]])if(!Number.isInteger(+input.value)||+input.value<min||+input.value>max)throw Error('上下文或输出上限超出范围');invalidate();Object.assign(cfg,{url:url.value.trim(),allowHttp:allowHttp.checked,model:model.value.trim(),enabled:enabled.checked,proactive:proactive.checked,maxChars:+chars.value,history:+history.value,maxTokens:+tokens.value,loreChars:+loreChars.value});delete cfg.persona;delete cfg.profiles;sessionKey=key.value.trim();context().saveSettingsDebounced();installStatePrompt();status('设置已保存');}
  button('保存设置',async()=>{await save();ui.home();schedule();});
  button('测试连接（会发送一条简短测试）',async()=>{await save();const value=await completion([{role:'user',content:'请只回复：连接成功'}]);status('API 已连接：'+value.slice(0,60));});
  button('重新读取正文变量',async()=>{if(working||generation)throw Error('请等待正文或当前同步结束');await save();await syncNarrative(true);});
  button('导出本聊天存档',()=>{const blob=new Blob([JSON.stringify(store(),null,2)],{type:'application/json'});const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download='junimo-pocket-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
  const edit=field('当前状态 JSON（可校正初始金币、日期、物品等）','textarea',JSON.stringify(currentId()?world(store()):ui.initial,null,2));
  button('应用校正并设为当前进度基线',async()=>{if(working)throw Error('请等待当前请求结束');const state=applyPatch(ui.initial,validatePatch(JSON.parse(edit.value)));invalidate();const s=store(),rows=await signatures();s.backup={base:s.base,turns:s.turns,manual:s.manual,draft:s.draft};s.base=state;s.turns=rows.map(r=>({signature:r.signature,state:clone(state),messages:[]}));s.draft=null;await persist();render();status('已校正；旧状态已保留为上一次备份');});
  button('恢复上一次校正前的备份',async()=>{if(working)throw Error('请等待当前请求结束');const s=store();if(!s.backup)throw Error('没有备份');invalidate();const backup=s.backup;delete s.backup;Object.assign(s,backup);await persist();render();status('已恢复备份');});
  button('返回桌面',()=>ui.home());
}
function clamp(){const scale=Math.max(.2,Math.min(1,(innerHeight-24)/680,(innerWidth-24)/350));panel.style.setProperty('--jp-scale',scale);const width=phoneOpen?350*scale:58,height=phoneOpen?680*scale:58;host.style.left=Math.max(6,Math.min(parseFloat(host.style.left)||innerWidth-width-18,innerWidth-width-6))+'px';host.style.top=Math.max(6,Math.min(parseFloat(host.style.top)||70,innerHeight-height-6))+'px';}
function toggle(){phoneOpen=!phoneOpen;panel.hidden=!phoneOpen;badge.hidden=phoneOpen;clamp();}
function boot(){
  if(booted)return;booted=true;Object.assign(config(),{...defaults,...config()});
  try{const saved=JSON.parse(localStorage.getItem('junimo_pocket_api_presets_v1')||'null');const p=saved?.items?.find(x=>x.id===saved.active);if(p){Object.assign(config(),{url:p.url,model:p.model,allowHttp:!!p.allowHttp});sessionKey=p.key||'';}}catch{}
  host=document.createElement('div');host.id='junimo-pocket-extension';host.style.cssText='position:fixed;z-index:2147483000;left:'+(config().left??Math.max(6,innerWidth-76))+'px;top:'+config().top+'px';const shell=host.attachShadow({mode:'open'});
  shell.innerHTML='<style>:host{font:13px Microsoft YaHei,sans-serif}[hidden]{display:none!important}.panel{position:relative;width:calc(350px * var(--jp-scale,1));height:calc(680px * var(--jp-scale,1));background:transparent;border:0;padding:0;box-shadow:none}.phone{width:350px;transform:scale(var(--jp-scale,1));transform-origin:top left}.badge{position:relative;display:block;width:58px;height:58px;padding:0;border:0;background:transparent;cursor:grab;touch-action:none;filter:drop-shadow(0 4px 6px #52364155)}.badge img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}.badge.unread:after{content:"";position:absolute;right:2px;top:3px;width:9px;height:9px;border-radius:50%;background:#e87698;border:2px solid white}.badge:active{transform:scale(.94)}</style><button class="badge" aria-label="打开月亮谷手机" title="点击打开 · 按住拖动"><img src="https://iili.io/ndvIRsV.png" alt=""></button><div class="panel" hidden><div class="phone"></div></div>';
  document.body.append(host);panel=shell.querySelector('.panel');badge=shell.querySelector('.badge');const root=shell.querySelector('.phone').attachShadow({mode:'open'});
  ui=mountPhone(root,{send,queueBubble,compose,openSettings,collapse:toggle,draftChanged:saveDraft,read(id){if(!currentId())return;const s=store();if(s.unread[id]){s.unread[id]=false;context().saveMetadataDebounced?.();}}});settingsPanel=ui.settingsBody;statusLine=ui.statusLine;
  let moved=false,drag;badge.onclick=()=>{if(!moved)toggle();};
  for(const handle of [badge,...ui.dragHandles]){handle.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button:not(.badge)'))return;if(handle.classList.contains('device')&&e.target!==handle)return;moved=false;drag={x:e.clientX,y:e.clientY,left:parseFloat(host.style.left),top:parseFloat(host.style.top)};handle.setPointerCapture(e.pointerId);});handle.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;if(moved){host.style.left=drag.left+dx+'px';host.style.top=drag.top+dy+'px';clamp();}});handle.addEventListener('pointerup',()=>{if(drag){drag=null;Object.assign(config(),{left:parseFloat(host.style.left),top:parseFloat(host.style.top)});context().saveSettingsDebounced();}});handle.addEventListener('pointercancel',()=>{drag=null;});}
  addEventListener('resize',clamp);clamp();render();storeRef=context().chatMetadata;
  const c=context(),events=c.eventTypes??c.event_types;const on=(name,fn)=>{if(events[name])c.eventSource.on(events[name],fn);};
  on('CHAT_CHANGED',()=>{invalidate();generation=false;storeRef=context().chatMetadata;ui.closeRoom();ui.home();render();status('已切换对话');ui.setLoreStatus('下次请求将检查当前卡的世界书绑定');installStatePrompt();schedule();});
  for(const name of ['WORLDINFO_UPDATED','WORLDINFO_SETTINGS_UPDATED','CHARACTER_EDITED'])on(name,()=>{ui.setLoreStatus('设定已变化，下次请求读取更新后的世界书');});
  on('GENERATION_STARTED',(type,options,dryRun)=>{installStatePrompt();if(dryRun||type==='quiet'||type==='impersonate')return;generation=true;invalidate();status('正文正在生成，完成后自动同步');});on('GENERATION_ENDED',()=>{generation=false;schedule();});on('GENERATION_STOPPED',()=>{generation=false;schedule();});
  for(const name of ['MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SWIPED'])on(name,()=>{invalidate();schedule();});
  on('CHARACTER_MESSAGE_RENDERED',schedule);on('MESSAGE_RECEIVED',schedule);installStatePrompt();schedule();
}
if(globalThis.SillyTavern?.getContext){const c=context(),e=c.eventTypes??c.event_types;if(e.APP_READY)c.eventSource.on(e.APP_READY,()=>{setTimeout(boot,0);});else boot();}
