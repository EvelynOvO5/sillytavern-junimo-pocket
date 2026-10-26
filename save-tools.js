import {validateShopSave} from './shop.js';
import {withoutCandidateMetadata,noteCandidateRestore} from './candidate-progress.js';
import {compactClone,unpackSave,isPackedSave,withCheckpointFields} from './save-compaction.js';
import {adoptDressingOutfit} from './wardrobe.js';
import {dressingOutfit,applyDressingState} from './clothing-equipment.js';
import {validateStorage,rebaseStorageBaseline} from './storage-chests.js';
import {rebaseAnimalCalendar} from './animals.js';
import {isLetterDeleted,isLetterArchived} from './mail-records.js';
import {syncExpiredMailQuests} from './quest-state.js';
import {sameItem,itemCount,itemKey} from './item-quality.js';
import {world,validatePatch,applyPatch} from './core.js';
import {socialRevision,appendTransaction} from './social.js';
import {recoveryCandidates,applyRecoveredMessages} from './message-recovery.js';
const copy=x=>structuredClone(x);
const conflict=e=>/手机交易与(?:背包存档|正文余额)冲突/.test(e.message);
export function repairSnapshot(s){try{return {state:world(s),conflict:false,pending:[]};}catch(e){if(!conflict(e))throw e;const turn=s.turns?.findLast(t=>t?.state),revision=turn?.socialRevision??s.baseSocialRevision??0;return {state:world({...s,socialEvents:[]}),conflict:true,error:e.message,pending:copy((s.socialEvents||[]).filter(e=>e.revision>revision))};}}
export function quarantineCraftConflict(s,id){
 const event=s.socialEvents?.find(e=>e.id===id);if(!event?.id.startsWith('craft-')||event.gold||event.skillsXp||!event.items?.some(x=>x.count<0)||!event.items.some(x=>x.count>0))throw Error('只能隔离有材料与成品记录的无金币旧制作，请手动核对其他交易');
 const latest=s.turns?.findLast(t=>t?.state)?.state||s.base;
 if(event.items.some(x=>(itemCount(latest.inventory,x))!==0))throw Error('这笔交易已有物品数量，不能按缺失制作隔离');
 s.transactionResolutions??={};if(s.transactionResolutions[id])return false;
 s.transactionResolutions[id]={items:event.items.map(x=>({name:x.name,count:x.count,...(x.quality!==undefined?{quality:x.quality}:{})})),reason:'旧制作成品待用户核对'};
 s.pendingItemResolutions??=[];for(const item of event.items.filter(x=>x.count>0))s.pendingItemResolutions.push({id:id+':'+item.name,eventId:id,name:item.name,count:item.count,...(item.quality!==undefined?{quality:item.quality}:{}),status:'pending'});
 for(const t of s.turns||[])if(t.before?.socialEvents?.some(e=>e.id===id)){t.before.transactionResolutions=copy(s.transactionResolutions);t.before.pendingItemResolutions=copy(s.pendingItemResolutions);}
 return true;
}
export function resolvePendingItem(s,id,choice){const row=s.pendingItemResolutions?.find(x=>x.id===id&&x.status==='pending');if(!row)throw Error('该成品已核对或不存在');const state=world(s),owned=itemCount(state.inventory,row);if(choice==='return'){if(owned)throw Error('背包已有该物品，请核对后选择“已经在背包中”');appendTransaction(s,state,{id:'resolve-'+row.id,items:[{name:row.name,count:row.count,...(row.quality!==undefined?{quality:row.quality}:{}),kind:'item',price:0,priceUnknown:true}],description:'用户确认找回旧制作成品 '+row.name});}else if(choice==='present'){if(owned<row.count)throw Error('背包数量不足，不能确认已在背包中');}else if(choice!=='used')throw Error('请选择明确的处理方式');row.status=choice;}
const backupKeys=['base','baseSocialRevision','turns','manual','draft','socialEvents','transactionResolutions','pendingItemResolutions','sprinklers','inventoryRemovals','skillEventLog','letters','posts','comments','mailQuests','herd','animalCalendarCorrection','storage','shop'];
export function saveProgressBackup(s){return compactClone(withoutCandidateMetadata(Object.fromEntries(backupKeys.map(k=>[k,s[k]??null]))));}

// Confirmed status only: rewards and materials are already accounted for elsewhere.
export function syncConfirmedMailQuestStatuses(s,quests=[]){
 let changed=false;const key=x=>String(x||'').normalize('NFKC').trim();
 for(const task of quests){if(!/^(?:已结算|已领取|已交付|completed)(?:$|[（( ·：:,，。;；/、])/i.test(String(task.status||'').trim()))continue;
  const matches=(s.mailQuests||[]).filter(q=>task.mailQuestId?q.id===task.mailQuestId:key(q.subject)===key(task.name));
  if(matches.length!==1||matches[0].status==='completed')continue;matches[0].status='completed';matches[0].completed=Date.now();matches[0].manualStatusConfirmed=true;changed=true;
 }return changed;
}
export function repairSavedMailQuestBaseline(s){
 if(!s.backup||!s.turns?.length||!s.turns.every(t=>t?.playerCorrectionSnapshot))return false;
 const latest=s.turns.at(-1).state;const confirmed=(s.base?.quests||[]).filter(q=>(latest?.quests||[]).some(t=>t.name===q.name&&t.status===q.status&&t.mailQuestId===q.mailQuestId));
 return syncConfirmedMailQuestStatuses(s,confirmed);
}
export function rememberInventoryRemovals(s,before,after){
 const known=new Map((s.inventoryRemovals||[]).map(i=>[itemKey(i),i]));for(const item of before||[])if(item.count>0&&!(after||[]).some(i=>sameItem(i,item)&&i.count>0))known.set(itemKey(item),{...copy(item),count:0,floor:s.turns?.length||0});for(const item of after||[])if(item.count>0)known.delete(itemKey(item));s.inventoryRemovals=[...known.values()];
}
export function applyMaintenanceFields(s,patch,rows){
 if(Object.keys(patch).some(k=>!['capacity','inventory'].includes(k)))throw Error('仅允许校正容量或背包');validatePatch(patch);if(patch.inventory)patch={...patch,inventory:patch.inventory.filter(i=>i.count>0)};const current=repairSnapshot(s);if(current.conflict&&patch.inventory)throw Error('请先核对冲突交易后再修改背包清单');const lastStory=rows.findLastIndex(r=>!r.message?.is_user&&!r.message?.is_system),start=lastStory<0?Math.max(0,s.turns.length-1):lastStory;if(s.turns.length&&start>=s.turns.length)throw Error('正文尚未同步完成，请同步后再保存校正');const backup=saveProgressBackup(s);if(patch.inventory)rememberInventoryRemovals(s,current.state.inventory,patch.inventory);if(patch.capacity!==undefined){const revision=s.turns.findLast(t=>t?.state)?.socialRevision??s.baseSocialRevision??0;for(const event of (s.socialEvents||[]).filter(e=>e.revision>revision&&e.capacity!==undefined)){(s.transactionResolutions??={})[event.id]={...(s.transactionResolutions?.[event.id]||{}),capacity:event.capacity,reason:'用户已手动校正背包格数'};}}
 if(!s.turns.length){s.base=applyPatch(patch.inventory?current.state:s.base,patch);if(patch.inventory)s.baseSocialRevision=socialRevision(s);}else for(let i=start;i<s.turns.length;i++){if(!s.turns[i]?.state)continue;s.turns[i].state=applyPatch(patch.inventory?current.state:s.turns[i].state,patch);s.turns[i].playerCorrectionSnapshot=true;if(patch.inventory)s.turns[i].socialRevision=socialRevision(s);}
 s.backup=backup;return applyPatch(current.state,patch);
}
export function applyConfirmedBaseline(s,state,rows){validatePatch(state);state={...copy(state),inventory:state.inventory.filter(i=>i.count>0)};const saved=saveProgressBackup(s);if(s.storage?.dressing&&state.player?.outfit!==undefined&&state.player.outfit!==dressingOutfit(s.storage.dressing)){s.storage=adoptDressingOutfit(s,state,state.player.outfit);state=applyDressingState(state,s.storage);}rememberInventoryRemovals(s,repairSnapshot(s).state.inventory,state.inventory);syncConfirmedMailQuestStatuses(s,state.quests);syncExpiredMailQuests(s,state.quests);rebaseAnimalCalendar(s,state);rebaseStorageBaseline(s);s.base=copy(state);s.baseSocialRevision=socialRevision(s);s.turns=rows.map((r,i)=>({...s.turns?.[i],signature:r.signature,storyId:r.storyId,...(s.turns?.[i]?.before&&(s.herd||s.storage)?{before:withCheckpointFields(s.turns[i].before,{herd:copy(s.herd??null),animalCalendarCorrection:copy(s.animalCalendarCorrection??null),...(s.storage?{storage:copy(s.storage),socialEvents:copy(s.socialEvents||[])}:{})})}:{}),state:copy(state),socialRevision:socialRevision(s),messages:copy(s.turns?.[i]?.messages||[]),playerCorrectionSnapshot:true}));s.draft=null;s.backup=saved;}
export function restoreProgressBackup(s){if(!s.backup)throw Error('没有备份');const saved=s.backup;delete s.backup;for(const key of backupKeys){if(!(key in saved)){if(['transactionResolutions','pendingItemResolutions','sprinklers','inventoryRemovals','shop'].includes(key))delete s[key];continue;}if(saved[key]==null)delete s[key];else s[key]=key==='turns'?compactClone({turns:saved[key]}).turns:copy(saved[key]);}noteCandidateRestore(s);}
export function confirmConflictRepair(s,state,patch){
 const snap=repairSnapshot(s);if(!snap.conflict)return;
 if(!Object.hasOwn(patch,'inventory')||snap.pending.some(e=>e.gold)&&!Object.hasOwn(patch,'gold'))throw Error('交易冲突需要确认完整背包及涉及的金币字段，请选择背包或全部范围');
 validatePatch(state);s.transactionResolutions??={};for(const e of snap.pending){s.transactionResolutions[e.id]={...s.transactionResolutions[e.id],...(e.gold?{gold:e.gold}:{}),items:(e.items||[]).map(x=>({name:x.name,count:x.count,...(x.quality!==undefined?{quality:x.quality}:{})})),reason:'用户核对绝对背包数量后确认'};
  for(let i=0;i<(s.turns||[]).length;i++){const before=s.turns[i]?.before,previous=s.turns[i-1]?.state||s.base;if(!before?.socialEvents?.some(x=>x.id===e.id))continue;const count=(v,item)=>itemCount(v.inventory,item);if((e.items||[]).every(x=>count(previous,x)===count(state,x))&&(!e.gold||previous.gold===state.gold)){before.transactionResolutions={...before.transactionResolutions,[e.id]:copy(s.transactionResolutions[e.id])};}}
 }
}
const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const repairKeys=['transactionResolutions','pendingItemResolutions','draft'];
export function markImportRepairs(original,repaired){
 const changes=[];const add=(path,a,b)=>{if(!equal(a,b))changes.push({path,before:copy(a??null),after:copy(b??null)});};
 for(const key of repairKeys)add([key],original[key],repaired[key]);
 for(let i=0;i<repaired.turns.length;i++)for(const key of [...repairKeys,'actionDraft'])add(['turns',i,'before',key],original.turns[i]?.before?.[key],repaired.turns[i]?.before?.[key]);
 repaired.repairAudit={...repaired.repairAudit,changes};return repaired;
}
export function prepareFullImport(current,source,rows,roles=[]){
 const compactSource=isPackedSave(source);source=unpackSave(source);
 if(source?.version!==3||!Array.isArray(source.turns)||!Array.isArray(source.manual))throw Error('不是完整手机存档');
 if(!compactSource&&/"(?:__proto__|constructor|prototype)"\s*:/.test(JSON.stringify(source)))throw Error('无效存档属性');
 const incoming=compactClone(current),candidates=recoveryCandidates(incoming,source,roles);applyRecoveredMessages(incoming,candidates);
 const report={messages:candidates.length,records:0,repairs:0,skipped:0};
 const common=Math.min(source.turns.length,incoming.turns.length),matched=i=>source.turns[i]?.signature===incoming.turns[i]?.signature;
 for(const key of ['letters','posts','comments']){
  const seen=new Set([...(incoming[key]||[]),...incoming.turns.flatMap(t=>t[key]||[])].map(x=>x.id));
  const deleted=new Set(key==='letters'?incoming.deletedLetterIds||[]:key==='posts'?incoming.deletedPostIds||[]:key==='comments'?incoming.deletedCommentIds||[]:[]);
  const add=(record,floor)=>{if(!record?.id||seen.has(record.id)||deleted.has(record.id)||key==='letters'&&isLetterDeleted(incoming,record)||key==='comments'&&(incoming.deletedPostIds||[]).includes(record.postId))return;seen.add(record.id);(incoming[key]??=[]).push(key==='letters'?{...copy(record),archived:isLetterArchived(source,record)}:copy(record));report.records++;for(let j=floor+1;j<incoming.turns.length;j++)if(incoming.turns[j].before){const list=incoming.turns[j].before[key]??=[];if(!list.some(x=>x.id===record.id))list.push(copy(record));}};
  for(let i=0;i<common;i++)if(matched(i))for(const record of source.turns[i][key]||[])add(record,i);
  if(matched(source.turns.length-1))for(const record of source[key]||[])add(record,source.turns.length-1);
 }
 if(!incoming.storage&&source.storage){validateStorage(source.storage);const sameLast=matched(source.turns.length-1),ids=source.storage.ledgerIds||[],proof=ids.length&&ids.every(id=>{const a=incoming.socialEvents?.find(e=>e.id===id),b=source.socialEvents?.find(e=>e.id===id);return a&&b&&equal(a,b);});const currentIds=(incoming.socialEvents||[]).filter(e=>e.id.startsWith('storage-')||e.description?.includes('储物箱已直接放置')||ids.includes(e.id)).map(e=>e.id);const sameLedger=proof&&currentIds.length===ids.length;let sameBag=false;try{const a=world(incoming),b=world(source);sameBag=a.gold===b.gold&&equal(a.inventory,b.inventory);}catch{}if(sameLast&&sameLedger&&sameBag){incoming.storage=copy(source.storage);report.repairs++;}else report.skipped++;}
 if(incoming.storage&&!incoming.storage.dressing&&source.storage?.dressing){validateStorage(source.storage);const ids=source.storage.ledgerIds||[],sameState=equal({...incoming.storage,dressing:null},{...source.storage,dressing:null}),proof=ids.length&&ids.every(id=>{const a=incoming.socialEvents?.find(e=>e.id===id),b=source.socialEvents?.find(e=>e.id===id);return a&&b&&equal(a,b);});let sameBag=false;try{const a=world(incoming),b=world(source);sameBag=a.gold===b.gold&&equal(a.inventory,b.inventory);}catch{}if(matched(source.turns.length-1)&&sameState&&proof&&sameBag){incoming.storage.dressing=copy(source.storage.dressing);report.repairs++;}else report.skipped++;}
 if(!incoming.shop&&source.shop){validateShopSave(source.shop);const isOrderEvent=e=>e.id?.startsWith('shop-pay-')||e.id?.startsWith('shop-claim-')||e.id?.startsWith('shop-checkout-'),currentEvents=(incoming.socialEvents||[]).filter(isOrderEvent),sourceEvents=(source.socialEvents||[]).filter(isOrderEvent);let sameState=false;try{const a=world(incoming),b=world(source);sameState=a.gold===b.gold&&equal(a.inventory,b.inventory);}catch{}if(matched(source.turns.length-1)&&equal(currentEvents,sourceEvents)&&sameState){incoming.shop=copy(source.shop);report.repairs++;}else report.skipped++;}
 const changes=source.repairAudit?.changes||[];if(!Array.isArray(changes)||changes.length>10000)throw Error('修复标记无效');
 for(const change of changes){
  const path=change.path;if(!Array.isArray(path))throw Error('修复项目无效');
  const root=path.length===1&&repairKeys.includes(path[0]);
  const checkpoint=path.length===4&&path[0]==='turns'&&Number.isInteger(path[1])&&path[2]==='before'&&[...repairKeys,'actionDraft'].includes(path[3]);
  if(!root&&!checkpoint)throw Error('不支持的修复项目');
  const sourceValue=root?source[path[0]]:source.turns[path[1]]?.before?.[path[3]];
  if(!equal(sourceValue,change.after))throw Error('修复标记与存档内容不一致');
  // Old repair metadata must never cancel newer actions or overwrite later confirmations.
  if(root&&(source.turns.length!==incoming.turns.length||!source.turns.every((t,i)=>matched(i)))){report.skipped++;continue;}
  if(checkpoint&&!matched(path[1])){report.skipped++;continue;}
  const parent=root?incoming:incoming.turns[path[1]]?.before,key=path.at(-1);if(!parent){report.skipped++;continue;}
  if(equal(parent[key],change.after))continue;
  if(!equal(parent[key],change.before)){report.skipped++;continue;}
  if(change.after===null)delete parent[key];else parent[key]=copy(change.after);report.repairs++;
 }
 if(report.repairs)validatePatch(world(incoming));
 if(!report.messages&&!report.records&&!report.repairs)throw Error(report.skipped?'这些修复项目对应的数据已经变化，未覆盖当前进度':'没有需要补回的记录或新的修复项目');
 incoming.importBackup=copy({...current,importBackup:undefined});incoming.importReport=report;return incoming;
}
