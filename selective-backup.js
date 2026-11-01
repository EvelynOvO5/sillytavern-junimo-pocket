import {saveCssPreset} from './customization.js';
import {world,validatePatch} from './core.js';
import {packSave,unpackSave,compactClone} from './save-compaction.js';
import {visibleMessages} from './phone-records.js';
import {storedLetters} from './mail-records.js';
import {allPosts} from './community.js';
import {checkpoint} from './round-sync.js';
import {validateStorage} from './storage-chests.js';
import {validateShopSave} from './shop.js';
export const backupGroups=[
 ['progress','游戏进度与物品','金币、日期、容量、背包、衣柜、穿搭、箱子、经验、任务、农田、动物、图纸、献祭、商城与交易一起恢复'],
 ['chat','聊天与联系人','私聊、群聊、语音、红包与赠礼记录、联系人和删除记录'],
 ['mail','信件','收件箱、归档、信件正文与删除记录；已接委托属于游戏进度'],
 ['feed','朋友圈','动态、评论、个人资料及删除记录'],
 ['catalog','图鉴','已发现物品与自定义分类'],
 ['theatre','剧场','剧本、已结束的剧场存档与领取凭据'],
 ['appearance','外观与桌面','全局 CSS、聊天 CSS、预设、壁纸和图标设置、头像及 App 排列'],
 ['preferences','提示词与同步偏好','不包含 API 地址、模型、Key 或 API 预设'],
 ['stickers','表情包库','本机表情包文件或链接及说明'],
 ['images','图片素材库','照片、壁纸、头像和自定义图标素材；恢复外观时建议同时选择'],
 ['history','历史回退与候选进度','高级备份：含旧快照、A/B 候选与校正备份；会同时包含全部手机数据，文件更大']
].map(([id,label,detail])=>({id,label,detail}));
export const phoneGroups=['progress','chat','mail','feed','catalog','theatre'];
const keys={chat:['manual','unread','chatRound','deletedMessageIds','customGroups','chatNames'],mail:['letters','mailRound','deletedLetterIds','deletedLetterKeys','archivedLetterIds','archivedLetterKeys'],feed:['posts','comments','deletedPostIds','deletedCommentIds','feedProfile'],catalog:['catalog'],theatre:['theatre'],appearance:['avatars','chatAppearance']};
const preferenceKeys=['enabled','proactive','stickerVision','maxChars','history','maxTokens','mailTokens','repairTokens','feedFrequency','commentFrequency','mailPreferences','loreChars','requestTimeout','appPrompts','presetName','mailCustomRules','offeringRequirements'];
const appearanceKeys=['appearance','homeAppLayout','homeAppOrder'];
const excluded=new Set(['turns','base','baseSocialRevision','version','toJSON','backup','recordBackup','structureBackup','legacyBackup','demoBackup','turnGapBackup','importBackup','importReport','candidateProgress','candidateContinuation','candidateGeneration',...Object.values(keys).flat()]);
const copy=x=>compactClone({value:x}).value;
const pick=(x,names)=>Object.fromEntries(names.filter(k=>x[k]!==undefined).map(k=>[k,copy(x[k])]));
const unique=rows=>[...new Map(rows.filter(Boolean).map(x=>[x.id||JSON.stringify(x),x])).values()];
export function currentBackupParts(s,cfg={}){
 const state=world(s);validatePatch(state);
 const progress=Object.fromEntries(Object.keys(s).filter(k=>!excluded.has(k)).map(k=>[k,s[k]]));
 progress.state=state;progress.baseSocialRevision=Math.max(s.baseSocialRevision||0,s.turns?.at(-1)?.socialRevision||0,...(s.socialEvents||[]).map(e=>e.revision||0));
 const out={progress:copy(progress)};
 for(const id of ['chat','mail','feed','catalog','theatre','appearance'])out[id]=pick(s,keys[id]);
 out.chat.manual=copy(unique(visibleMessages(s)));
 out.mail.letters=copy(storedLetters(s));out.feed.posts=copy(unique(allPosts(s)));
 out.feed.comments=copy(unique([...(s.comments||[]),...(s.turns||[]).flatMap(t=>t.comments||[])].filter(c=>!(s.deletedCommentIds||[]).includes(c.id))));
 out.appearance.settings=pick(cfg,appearanceKeys);out.preferences=pick(cfg,preferenceKeys);
 return out;
}
export function createBackup({store,settings={},assets=[],selected,origin}){
 const ids=new Set(selected);if(!ids.size)throw Error('请至少选择一项');
 if(store.theatre?.active&&phoneGroups.some(id=>ids.has(id))&&!ids.has('history'))throw Error('剧场进行中请勾选“历史回退与候选进度”，一起备份暂停的主线与 IF 进度');
 if(ids.has('history'))for(const id of phoneGroups)ids.add(id);
 const parts=currentBackupParts(store,settings),data={};
 for(const id of ids){if(!backupGroups.some(g=>g.id===id))throw Error('未知备份项目');if(id==='history')data.history=packSave(store);else if(phoneGroups.includes(id)&&ids.has('history'))continue;else if(id==='stickers'||id==='images')data[id]=copy(assets.filter(a=>(a.category==='image')===(id==='images')));else data[id]=parts[id];}
 return {format:'junimo-pocket-backup',version:1,created:Date.now(),selected:[...ids],origin:copy(origin||{}),data:packSave(data)};
}
export function readBackup(input){
 if(input?.format==='junimo-pocket-backup'){
  if(input.version!==1||!Array.isArray(input.selected)||input.selected.some(id=>!backupGroups.some(g=>g.id===id)))throw Error('不支持的备份版本或项目');
  const data=unpackSave(input.data);for(const id of input.selected)if(id!=='history'&&!(data.history&&phoneGroups.includes(id))&&!Object.hasOwn(data,id))throw Error('备份缺少所选项目：'+id);
  if(data.history){const s=unpackSave(data.history);if(s.version!==3||!Array.isArray(s.turns)||!Array.isArray(s.manual))throw Error('历史手机存档无效');const parts=currentBackupParts(s);for(const id of phoneGroups)data[id]=parts[id];}
  return {...input,data};
 }
 const s=unpackSave(input);if(s?.version!==3||!Array.isArray(s.turns)||!Array.isArray(s.manual))throw Error('这不是可识别的手机存档');
 const data=currentBackupParts(s);delete data.preferences;delete data.appearance.settings;
 data.history=packSave(s);
 return {format:'junimo-pocket-backup',version:1,legacy:true,selected:[...phoneGroups,'appearance','history'],origin:{signatures:s.turns.map(t=>t.signature)},data};
}
export function sameBackupChat(file,origin,{exact=true}={}){
 const a=file.origin?.rawKeys||file.origin?.signatures,b=file.origin?.rawKeys?origin?.rawKeys:origin?.signatures;
 if(!a?.length||!b?.length)return false;const n=Math.min(a.length,b.length);return (!exact||a.length===b.length)&&a.slice(0,n).every((v,i)=>v===b[i]);
}
function mergeRecords(a,b,deleted=[]){const ids=new Set(deleted),map=new Map((a||[]).map(x=>[x.id,x]));for(const r of b||[])if(!ids.has(r.id)&&!map.has(r.id))map.set(r.id,copy(r));return [...map.values()];}
function assignGroup(out,source,names){for(const k of names){delete out[k];if(Object.hasOwn(source,k))out[k]=copy(source[k]);}}
export function planBackupImport({current,settings={},file,selected,mode='restore',origin,rows=[]}){
 const ids=new Set(selected),available=new Set(file.selected);if(!ids.size)throw Error('请至少选择一项');for(const id of ids)if(!available.has(id))throw Error('文件没有该项目：'+id);
 if(ids.has('history'))for(const id of phoneGroups)ids.add(id);
 const bound=[...ids].some(id=>phoneGroups.includes(id)||id==='history');
 if(bound&&!sameBackupChat(file,origin,{exact:true}))throw Error('存档与当前聊天楼层或分支不匹配。请打开导出时对应的聊天再恢复；外观和素材可以单独导入。');
 if(bound&&current.theatre?.active&&!ids.has('history'))throw Error('剧场进行中，请使用完整历史恢复，或先结束剧场再恢复部分手机数据');
 if(mode==='merge'&&(ids.has('progress')||ids.has('history')))throw Error('游戏进度不能相加补缺，请选择“恢复所选内容”');
 const previous=currentBackupParts(current,settings),chosen={...previous},source=file.data;
 for(const id of phoneGroups)if(ids.has(id))chosen[id]=copy(source[id]);
 if(mode==='merge'){
  if(ids.has('chat')){chosen.chat={...previous.chat,...chosen.chat};chosen.chat.deletedMessageIds=unique([...(previous.chat.deletedMessageIds||[]),...(source.chat.deletedMessageIds||[])].map(id=>({id}))).map(x=>x.id);chosen.chat.manual=mergeRecords(previous.chat.manual,source.chat.manual,chosen.chat.deletedMessageIds);chosen.chat.customGroups=mergeRecords(previous.chat.customGroups,source.chat.customGroups);chosen.chat.chatNames={...source.chat.chatNames,...previous.chat.chatNames};chosen.chat.unread={...source.chat.unread,...previous.chat.unread};}
  for(const [id,field,tomb]of [['mail','letters','deletedLetterIds'],['feed','posts','deletedPostIds']])if(ids.has(id)){chosen[id]={...previous[id]};chosen[id][field]=mergeRecords(previous[id][field],source[id][field],previous[id][tomb]);if(id==='feed')chosen[id].comments=mergeRecords(previous[id].comments,source[id].comments,previous[id].deletedCommentIds);}
  if(ids.has('catalog'))chosen.catalog.catalog={...(source.catalog.catalog||{}),...(previous.catalog.catalog||{})};
  if(ids.has('theatre')){if(source.theatre.theatre?.active)throw Error('进行中的剧场只能完整恢复');chosen.theatre.theatre={...previous.theatre.theatre,scripts:mergeRecords(previous.theatre.theatre?.scripts,source.theatre.theatre?.scripts),history:mergeRecords(previous.theatre.theatre?.history,source.theatre.theatre?.history)};}
 }
 // Records imported without the corresponding wallet must never mint old rewards again.
 if(!ids.has('progress')){
  if(ids.has('chat')){const old=new Map(previous.chat.manual.map(m=>[m.id,m]));chosen.chat.manual=chosen.chat.manual.map(m=>mode==='merge'&&old.has(m.id)?m:({...m,backupRecordOnly:true,...(old.has(m.id)?{claimed:old.get(m.id).claimed||m.claimed,packet:old.get(m.id).packet||m.packet}:{})}));}
  if(ids.has('mail')){const old=new Map(previous.mail.letters.map(m=>[m.id,m]));chosen.mail.letters=chosen.mail.letters.map(m=>mode==='merge'&&old.has(m.id)?m:({...m,backupRecordOnly:true}));}
 }
 let next=current;
 if(ids.has('history')){next=compactClone(unpackSave(source.history));if(!ids.has('appearance'))assignGroup(next,current,keys.appearance);}
 else if(bound){
  if(chosen.theatre.theatre?.active)throw Error('进行中的剧场只能通过完整历史恢复');
  next={version:3,...copy(chosen.progress)};const state=next.state;delete next.state;next.base=copy(state);next.baseSocialRevision=chosen.progress.baseSocialRevision;
  for(const id of phoneGroups.filter(x=>x!=='progress'))Object.assign(next,copy(chosen[id]));
  Object.assign(next,pick(current,keys.appearance));next.manual??=[];next.unread??={};
  const before=checkpoint(next),revision=next.baseSocialRevision;
  next.turns=rows.map(r=>({signature:r.signature,storyId:r.storyId,state:copy(state),socialRevision:revision,before,messages:[],letters:[],posts:[],comments:[],phoneDone:true,feedDone:true,mailDone:true,mailSyncVersion:1,playerCorrectionSnapshot:true}));
  next.draft=copy(chosen.progress.draft??null);
 }
 if(ids.has('appearance')){if(next===current)next=compactClone(current);if(mode==='merge')for(const k of keys.appearance)next[k]={...(source.appearance[k]||{}),...(current[k]||{})};else assignGroup(next,source.appearance,keys.appearance);}
 for(const id of ['chat','mail','feed'])if(ids.has(id)){const part=source[id];for(const key of keys[id])if(['manual','letters','posts','comments','customGroups','deletedMessageIds','deletedLetterIds','deletedLetterKeys','archivedLetterIds','archivedLetterKeys','deletedPostIds','deletedCommentIds'].includes(key)&&part[key]!==undefined&&!Array.isArray(part[key]))throw Error('记录列表格式无效：'+key);}
 const appearance=source.appearance?.settings?.appearance;if(ids.has('appearance')&&appearance){if(typeof appearance!=='object'||Array.isArray(appearance)||appearance.cssPresets!==undefined&&!Array.isArray(appearance.cssPresets))throw Error('美化预设格式无效');for(const preset of appearance.cssPresets||[])saveCssPreset([],preset);}
 const settingsPatch={};for(const [id,names]of [['appearance',appearanceKeys],['preferences',preferenceKeys]])if(ids.has(id)){const cfg=id==='appearance'?source.appearance.settings:source.preferences;if(cfg)for(const k of names)if(mode!=='merge'||settings[k]===undefined)settingsPatch[k]=Object.hasOwn(cfg,k)?copy(cfg[k]):undefined;}
 if(ids.has('appearance')&&mode==='merge'&&source.appearance.settings?.appearance){const incoming=source.appearance.settings.appearance,old=settings.appearance||{};settingsPatch.appearance={...copy(incoming),...copy(old),icons:{...(incoming.icons||{}),...(old.icons||{})},cssPresets:mergeRecords(old.cssPresets,incoming.cssPresets)};}
 if(bound){validatePatch(world(next));if(next.storage)validateStorage(next.storage);if(next.shop)validateShopSave(next.shop);}
 return {next,settingsPatch,selected:[...ids],phoneChanged:bound||ids.has('appearance'),mode};
}
function singleBackupSummary(data,id){const d=data[id];if(id==='history')return '完整历史';if(id==='progress'){const s=d?.state;return s?String(s.gold??0)+' 金币 · '+String(s.capacity??0)+' 格 · 背包 '+(s.inventory?.length||0)+' 项 · 衣柜/箱子 '+(d.storage?.chests?.length||0)+' 个':'游戏状态';}const rows=id==='chat'?d?.manual:id==='mail'?d?.letters:id==='feed'?d?.posts:id==='catalog'?Object.keys(d?.catalog||{}):id==='theatre'?d?.theatre?.history:id==='images'||id==='stickers'?d:null;return rows?rows.length+' 项':'';}

const pausedMainSummaries=new WeakMap();
export function backupSummary(file,id){
 const active=file.data.theatre?.theatre?.active;
 if(!active)return singleBackupSummary(file.data,id);
 if(id==='history')return '主线 + 当前 IF + 回退历史';
 if(id==='theatre')return '已归档 '+(file.data.theatre.theatre.history?.filter(h=>!h.archiveDeleted).length||0)+' 场 · 进行中 1 场';
 if(!['progress','chat','mail','feed','catalog'].includes(id))return singleBackupSummary(file.data,id);
 let main=pausedMainSummaries.get(file);if(!main){main=currentBackupParts(unpackSave(active.main));pausedMainSummaries.set(file,main);}
 if(id==='progress'){const brief=p=>String(p.progress.state.gold??0)+' 金 · '+String(p.progress.state.capacity??0)+' 格';return '主线 '+brief(main)+'；当前 IF '+brief(file.data);}
 return '主线 '+singleBackupSummary(main,id)+'；当前 IF '+singleBackupSummary(file.data,id);
}

const mediaKeys=new Set(['stickerId','mediaId','imageId','avatar','avatarId','wallpaper','wallpaperId','homeWallpaper','listWallpaper']);
export function remapBackupMedia(value,map){
 if(!Object.keys(map).length)return copy(value);
 function remap(v,context='',depth=0){if(depth>180)throw Error('素材引用嵌套过深');if(typeof v==='string')return (context==='ref'||context==='map')&&map[v]?map[v]:v;if(!v||typeof v!=='object')return v;if(v.format==='junimo-pocket-compact')return remapGraph(v);if(Array.isArray(v))return v.map(x=>remap(x,context==='map'?'ref':'',depth+1));const out={};for(const k of Object.keys(v))out[k]=remap(v[k],mediaKeys.has(k)||context==='map'?'ref':['avatars','icons'].includes(k)?'map':'',depth+1);return out;}
 function remapGraph(packed){unpackSave(packed);const nodes=[],memo=new Map(),intern=new Map();function visit(id,context=''){const mk=id+':'+context;if(memo.has(mk))return memo.get(mk);const n=packed.nodes[id];let v;if(!Array.isArray(n))v=typeof n==='string'&&(context==='ref'||context==='map')&&map[n]?map[n]:n;else if(n[0]===0)v=[0,n[1].map(i=>visit(i,context==='map'?'ref':''))];else v=[1,n[1].map(([k,i])=>[k,visit(i,mediaKeys.has(k)||context==='map'?'ref':['avatars','icons'].includes(k)?'map':'')])];const text=JSON.stringify(v);let out=intern.get(text);if(out===undefined){out=nodes.length;nodes.push(v);intern.set(text,out);}memo.set(mk,out);return out;}const root=visit(packed.root);let result={...packed,root,nodes};
 // A paused main line is itself an encoded graph stored inside the outer graph.
 const decoded=unpackSave(result);if(decoded.theatre?.active?.main){decoded.theatre={...decoded.theatre,active:{...decoded.theatre.active,main:remapGraph(decoded.theatre.active.main)}};result=packSave(decoded);}return result;}
 return remap(value);
}
