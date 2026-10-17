import {isLetterDeleted} from './mail-records.js';
import {visibleMessages} from './phone-records.js';
import {checkpoint} from './round-sync.js';

export function messageStoryId(message){
 const date=message.send_date;
 return date==null||date===''?'':JSON.stringify([!!message.is_user,message.name||'',String(date)]);
}
const same=(turn,row)=>!!turn&&(turn.storyId&&row.storyId?turn.storyId===row.storyId&&(turn.signature===row.signature||turn.signature===row.hiddenSignature):turn.signature===row.signature||turn.signature===row.hiddenSignature);

function moveProgress(progress,move){
 for(const event of progress.skillEventLog||[])if(Number.isInteger(event.floor))event.floor=move(event.floor);
 for(const event of progress.socialEvents||[])if(Number.isInteger(event.floor))event.floor=move(event.floor);
 for(const row of [...(progress.storage?.guards||[]),...(progress.storage?.conflicts||[])])if(Number.isInteger(row.floor))row.floor=move(row.floor);
 for(const key of ['chatRound','mailRound'])if(Number.isInteger(progress[key]?.floor))progress[key].floor=move(progress[key].floor);
}

// Detached phone records remain independently visible after their source
// narration is deleted. Older rollback checkpoints do not inherit them.
export function restoreDeletedStoryRecords(s){
 const backup=s.structureBackup;
 if(!backup||backup.reason!=='middle-deletion'||backup.recordsPreserved)return false;
 const families=[['messages','manual'],['letters','letters'],['posts','posts'],['comments','comments']];
 let restored=0;
 for(const removedIndex of backup.removed||[]){
  const source=backup.turns?.[removedIndex];if(!source)continue;
  const boundary=removedIndex-(backup.removed||[]).filter(i=>i<removedIndex).length;
  for(const [field,target] of families){
   const records=structuredClone(source[field]||[]);
   if(field==='messages')visibleMessages({manual:records});
   const add=destination=>{
    const existing=field==='messages'?visibleMessages(destination):[...(destination[target]||[]),...(destination.turns||[]).flatMap(t=>t?.[field]||[])];
    const seen=new Set(existing.map(x=>x.id));
    for(const record of records){
     if(!record.id||seen.has(record.id)||field==='letters'&&isLetterDeleted(s,record)||(s.deletedMessageIds||[]).includes(record.id)||(s.deletedPostIds||[]).includes(record.id)||(s.deletedCommentIds||[]).includes(record.id)||(field==='comments'&&(s.deletedPostIds||[]).includes(record.postId)))continue;
     (destination[target]??=[]).push(structuredClone(record));seen.add(record.id);if(destination===s)restored++;
    }
   };
   add(s);
   for(let i=boundary;i<(s.turns||[]).length;i++)if(s.turns[i]?.before)add(s.turns[i].before);
  }
 }
 backup.recordsPreserved=true;backup.restoredRecords=restored;
 return true;
}

// A middle deletion retains the original final message. A deleted suffix is
// still a story rollback. Match survivors in order, never rebuild their replies.
export function alignStoryStructure(s,rows){
 const original=s.turns||[];if(!original.length)return {deleted:0,hidden:0};
 const mapping=[];let cursor=0;
 for(const row of rows){let found=-1;for(let i=cursor;i<original.length;i++)if(same(original[i],row)){found=i;break;}if(found<0)break;mapping.push(found);cursor=found+1;}
 const retained=new Set(mapping),removed=original.map((_,i)=>i).filter(i=>!retained.has(i));
 const middle=mapping.length>0&&mapping.at(-1)===original.length-1&&removed.length>0;
 let deleted=0,hidden=0;
 if(middle){
  s.structureBackup={reason:'middle-deletion',removed,turns:structuredClone(original),progress:checkpoint(s),base:structuredClone(s.base),baseSocialRevision:s.baseSocialRevision||0};
  const move=index=>index-removed.filter(i=>i<index).length;
  s.turns=mapping.map((i,index)=>({...structuredClone(original[i]),...(i!==index?{structuralSnapshot:true}:{})}));deleted=removed.length;
  moveProgress(s,move);
  for(const turn of s.turns)if(turn.before)moveProgress(turn.before,move);
  for(const key of ['pendingNarrativeFloor','skillAccountingStartFloor'])if(Number.isInteger(s[key]))s[key]=move(s[key]);
  if(Number.isInteger(s.historyBootstrap?.floors))s.historyBootstrap.floors=move(s.historyBootstrap.floors);
  restoreDeletedStoryRecords(s);
 }
 for(let i=0;i<s.turns.length&&i<rows.length;i++){
  const turn=s.turns[i],row=rows[i];
  if(same(turn,row)){
   if(turn.signature!==row.signature){turn.signature=row.signature;hidden++;}
   if(row.storyId)turn.storyId=row.storyId;
  }
 }
 return {deleted,hidden};
}
