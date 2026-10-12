import {applySocialEvents} from './social.js';
const count=(state,name)=>(state.inventory||[]).find(x=>x.name===name)?.count||0;
export function transactionReceipt(state,items=[]){return {gold:state.gold,items:[...new Set(items.map(x=>x.name))].map(name=>({name,count:count(state,name)}))};}
function matches(state,expected){return state&&state.gold===expected.gold&&expected.items.every(item=>count(state,item.name)===item.count)&&Object.entries(expected.skills||{}).every(([name,xp])=>(state.player?.skills?.[name]||0)===xp);}

// Legacy snapshots may contain only some transaction effects. Confirm each
// effect separately so unrelated pending transactions cannot be skipped.
function legacyTransfer(event, turn) {
 const message=turn.before?.manual?.find(m=>m.id===event.id&&m.from==='me'&&m.claimed);
 if(!message)return false;
 if(message.type==='gift')return !event.gold&&event.items?.length===1&&event.items[0].name===message.item&&event.items[0].count===-message.count;
 return message.type==='redpacket'&&event.gold===-message.amount&&!event.items?.length;
}
function legacyCraft(event) {
 return event.id?.startsWith('craft-')&&!event.skillsXp&&event.items?.some(x=>x.count<0)&&event.items.some(x=>x.count>0);
}
function repairLegacyEffects(s) {
 const turns=s.turns||[],events=s.socialEvents||[],groups=new Map();let changed=false;
 for(const event of events){
  const first=turns.findIndex(t=>t?.before?.socialEvents?.some(e=>e.id===event.id));
  if(first<0)continue;
  if(!groups.has(first))groups.set(first,[]);groups.get(first).push(event);
 }
 const starts=[...groups.keys()].sort((a,b)=>a-b);
 for(let g=0;g<starts.length;g++){
  const start=starts[g],end=starts[g+1]??turns.length,previous=turns[start-1];
  if(!previous?.state)continue;
  const group=groups.get(start),eligible=group.filter(e=>turns[start].before.socialEvents.some(old=>old.id===e.id&&JSON.stringify([old.gold||0,old.items||[],old.skillsXp||{}])===JSON.stringify([e.gold||0,e.items||[],e.skillsXp||{}]))&&!e.after&&/^[\w:-]+$/.test(e.id)&&e.revision>(previous.socialRevision||0)&&!e.skillsXp&&
   (e.items||[]).every(x=>typeof x.name==='string'&&Number.isInteger(x.count)&&x.count!==0)&&
   (legacyTransfer(e,turns[start])||legacyCraft(e)));
  const fields=new Set(eligible.flatMap(e=>(e.items||[]).map(x=>x.name))),proofs=[];
  for(const name of fields){
   const affected=group.filter(e=>(e.items||[]).some(x=>x.name===name));
   if(affected.some(e=>!eligible.includes(e))||affected.some(e=>e.items.filter(x=>x.name===name).length!==1))continue;
   const delta=affected.reduce((sum,e)=>sum+e.items.find(x=>x.name===name).count,0),before=count(previous.state,name);
   if(!delta||before+delta<0)continue;
   const anchor=turns.findIndex((t,i)=>i>=start&&i<end&&t?.state&&t.hasState!==false&&count(t.state,name)===before+delta);
   if(anchor>=0)for(const event of affected)proofs.push({anchor,event,item:event.items.find(x=>x.name===name)});
  }
  const money=group.filter(e=>e.gold);
  if(money.length&&money.every(e=>eligible.includes(e))){
   const delta=money.reduce((sum,e)=>sum+e.gold,0),expected=previous.state.gold+delta;
   if(delta&&expected>=0){const anchor=turns.findIndex((t,i)=>i>=start&&i<end&&t?.state&&t.hasState!==false&&t.state.gold===expected);if(anchor>=0)for(const event of money)proofs.push({anchor,event,gold:event.gold});}
  }
  for(const proof of proofs)for(let i=proof.anchor;i<turns.length;i++){
   const turn=turns[i];if(!turn?.state||(turn.socialRevision||0)>=proof.event.revision)continue;
   const old=turn.transactionEffects?.[proof.event.id]||{},items=old.items||[];
   if((proof.item&&items.some(x=>x.name===proof.item.name&&x.count===proof.item.count))||(proof.gold&&old.gold===proof.gold))continue;
   (s.transactionEffectBackup??=[]).push({index:i,eventId:proof.event.id,previous:structuredClone(old),evidenceFloor:proof.anchor});
   turn.transactionEffects={...turn.transactionEffects,[proof.event.id]:{...old,...(proof.gold?{gold:proof.gold}:{}),items:proof.item?[...items,{name:proof.item.name,count:proof.item.count}]:items}};
   changed=true;
  }
 }
 return changed;
}

export function repairTransactionRevisions(s){const events=s.socialEvents||[],turns=s.turns||[];if(!events.length||!turns.length)return false;let changed=repairLegacyEffects(s);for(const event of events){if(!turns.some(t=>t?.state&&(t.socialRevision||0)<event.revision))continue;let anchor=-1;for(let i=0;i<turns.length;i++){const turn=turns[i];if(!turn?.state||(turn.socialRevision||0)>=event.revision||!turn.before?.socialEvents?.some(e=>e.id===event.id))continue;let expected=event.after;if(expected){if(!Number.isInteger(event.floor)||i<event.floor)continue;}else{const quest=event.id?.startsWith('quest-')&&(s.mailQuests||[]).find(q=>'quest-'+q.id===event.id&&q.status==='completed');if(!quest||!event.gold||!event.items?.some(x=>x.count<0))continue;let previous;for(let j=i-1;j>=0;j--){if(turns[j]?.state&&(turns[j].socialRevision||0)===event.revision-1){previous=turns[j].state;break;}}if(!previous)continue;try{expected=transactionReceipt(applySocialEvents(previous,[event],event.revision-1),event.items);}catch{continue;}}if(matches(turn.state,expected)){anchor=i;break;}}
 if(anchor<0)continue;for(let i=anchor;i<turns.length;i++){const turn=turns[i];if(!turn?.state||(turn.socialRevision||0)>=event.revision)continue;(s.transactionRevisionBackup??=[]).push({index:i,previous:turn.socialRevision||0,confirmed:event.revision,eventId:event.id});turn.socialRevision=event.revision;changed=true;}}
 return changed;}
export function narrativeRevision(s,old,prior,index,latestStory,message){const pending=index===latestStory&&!message.is_user&&s.pendingNarrativeRevision!=null&&(s.pendingNarrativeFloor==null||s.pendingNarrativeFloor===index);return pending?s.pendingNarrativeRevision:old?.socialRevision??prior?.socialRevision??s.baseSocialRevision??0;}
