import {world,validatePatch,applyPatch} from './core.js';
import {socialRevision,appendTransaction} from './social.js';
import {recoveryCandidates,applyRecoveredMessages} from './message-recovery.js';
const copy=x=>structuredClone(x);
const conflict=e=>/手机交易与(?:背包存档|正文余额)冲突/.test(e.message);
export function repairSnapshot(s){try{return {state:world(s),conflict:false,pending:[]};}catch(e){if(!conflict(e))throw e;const turn=s.turns?.findLast(t=>t?.state),revision=turn?.socialRevision??s.baseSocialRevision??0;return {state:world({...s,socialEvents:[]}),conflict:true,error:e.message,pending:copy((s.socialEvents||[]).filter(e=>e.revision>revision))};}}
export function quarantineCraftConflict(s,id){
 const event=s.socialEvents?.find(e=>e.id===id);if(!event?.id.startsWith('craft-')||event.gold||event.skillsXp||!event.items?.some(x=>x.count<0)||!event.items.some(x=>x.count>0))throw Error('只能隔离有材料与成品记录的无金币旧制作，请手动核对其他交易');
 const latest=s.turns?.findLast(t=>t?.state)?.state||s.base;
 if(event.items.some(x=>(latest.inventory.find(i=>i.name===x.name)?.count||0)!==0))throw Error('这笔交易已有物品数量，不能按缺失制作隔离');
 s.transactionResolutions??={};if(s.transactionResolutions[id])return false;
 s.transactionResolutions[id]={items:event.items.map(x=>({name:x.name,count:x.count})),reason:'旧制作成品待用户核对'};
 s.pendingItemResolutions??=[];for(const item of event.items.filter(x=>x.count>0))s.pendingItemResolutions.push({id:id+':'+item.name,eventId:id,name:item.name,count:item.count,status:'pending'});
 for(const t of s.turns||[])if(t.before?.socialEvents?.some(e=>e.id===id)){t.before.transactionResolutions=copy(s.transactionResolutions);t.before.pendingItemResolutions=copy(s.pendingItemResolutions);}
 return true;
}
export function resolvePendingItem(s,id,choice){const row=s.pendingItemResolutions?.find(x=>x.id===id&&x.status==='pending');if(!row)throw Error('该成品已核对或不存在');const state=world(s),owned=state.inventory.find(x=>x.name===row.name)?.count||0;if(choice==='return'){if(owned)throw Error('背包已有该物品，请核对后选择“已经在背包中”');appendTransaction(s,state,{id:'resolve-'+row.id,items:[{name:row.name,count:row.count,kind:'item',price:0,priceUnknown:true}],description:'用户确认找回旧制作成品 '+row.name});}else if(choice==='present'){if(owned<row.count)throw Error('背包数量不足，不能确认已在背包中');}else if(choice!=='used')throw Error('请选择明确的处理方式');row.status=choice;}
const backupKeys=['base','baseSocialRevision','turns','manual','draft','socialEvents','transactionResolutions','pendingItemResolutions','sprinklers','skillEventLog','letters','posts','comments','mailQuests','herd'];
export function saveProgressBackup(s){return Object.fromEntries(backupKeys.map(k=>[k,copy(s[k]??null)]));}

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
export function applyConfirmedBaseline(s,state,rows){validatePatch(state);const saved=saveProgressBackup(s);syncConfirmedMailQuestStatuses(s,state.quests);s.base=copy(state);s.baseSocialRevision=socialRevision(s);s.turns=rows.map((r,i)=>({...s.turns?.[i],signature:r.signature,storyId:r.storyId,state:copy(state),socialRevision:socialRevision(s),messages:copy(s.turns?.[i]?.messages||[]),playerCorrectionSnapshot:true}));s.draft=null;s.backup=saved;}
export function restoreProgressBackup(s){if(!s.backup)throw Error('没有备份');const saved=s.backup;delete s.backup;for(const key of backupKeys){if(!(key in saved)){if(['transactionResolutions','pendingItemResolutions','sprinklers'].includes(key))delete s[key];continue;}if(saved[key]==null)delete s[key];else s[key]=copy(saved[key]);}}
export function confirmConflictRepair(s,state,patch){
 const snap=repairSnapshot(s);if(!snap.conflict)return;
 if(!Object.hasOwn(patch,'inventory')||snap.pending.some(e=>e.gold)&&!Object.hasOwn(patch,'gold'))throw Error('交易冲突需要确认完整背包及涉及的金币字段，请选择背包或全部范围');
 validatePatch(state);s.transactionResolutions??={};for(const e of snap.pending){s.transactionResolutions[e.id]={...s.transactionResolutions[e.id],...(e.gold?{gold:e.gold}:{}),items:(e.items||[]).map(x=>({name:x.name,count:x.count})),reason:'用户核对绝对背包数量后确认'};
  for(let i=0;i<(s.turns||[]).length;i++){const before=s.turns[i]?.before,previous=s.turns[i-1]?.state||s.base;if(!before?.socialEvents?.some(x=>x.id===e.id))continue;const count=(v,name)=>v.inventory.find(x=>x.name===name)?.count||0;if((e.items||[]).every(x=>count(previous,x.name)===count(state,x.name))&&(!e.gold||previous.gold===state.gold)){before.transactionResolutions={...before.transactionResolutions,[e.id]:copy(s.transactionResolutions[e.id])};}}
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
 if(source?.version!==3||!Array.isArray(source.turns)||!Array.isArray(source.manual))throw Error('不是完整手机存档');
 if(/"(?:__proto__|constructor|prototype)"\s*:/.test(JSON.stringify(source)))throw Error('无效存档属性');
 const incoming=copy(current),candidates=recoveryCandidates(incoming,source,roles);applyRecoveredMessages(incoming,candidates);
 const report={messages:candidates.length,records:0,repairs:0,skipped:0};
 const common=Math.min(source.turns.length,incoming.turns.length),matched=i=>source.turns[i]?.signature===incoming.turns[i]?.signature;
 for(const key of ['letters','posts','comments']){
  const seen=new Set([...(incoming[key]||[]),...incoming.turns.flatMap(t=>t[key]||[])].map(x=>x.id));
  const deleted=new Set(key==='posts'?incoming.deletedPostIds||[]:key==='comments'?incoming.deletedCommentIds||[]:[]);
  const add=(record,floor)=>{if(!record?.id||seen.has(record.id)||deleted.has(record.id)||key==='comments'&&(incoming.deletedPostIds||[]).includes(record.postId))return;seen.add(record.id);(incoming[key]??=[]).push(copy(record));report.records++;for(let j=floor+1;j<incoming.turns.length;j++)if(incoming.turns[j].before){const list=incoming.turns[j].before[key]??=[];if(!list.some(x=>x.id===record.id))list.push(copy(record));}};
  for(let i=0;i<common;i++)if(matched(i))for(const record of source.turns[i][key]||[])add(record,i);
  if(matched(source.turns.length-1))for(const record of source[key]||[])add(record,source.turns.length-1);
 }
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
