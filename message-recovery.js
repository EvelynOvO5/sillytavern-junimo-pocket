export function recoveryCandidates(target,source,roles){
 if(source?.version!==3||!Array.isArray(source.turns)||!Array.isArray(source.manual)||source.turns.length<3)throw Error('请选择同一段聊天导出的手机存档');
 const common=Math.min(target.turns.length,source.turns.length),matches=source.turns.slice(0,common).filter((t,i)=>t.signature===target.turns[i]?.signature).length;
 if(common<3||matches/common<.8||source.turns.slice(0,3).some((t,i)=>t.signature!==target.turns[i]?.signature))throw Error('存档与当前聊天不匹配，未恢复任何记录');
 const groupMembers={'group-all':roles.map(r=>r.id),'group-twins':['10','11']};const ids=new Set([...roles.map(r=>r.id),...Object.keys(groupMembers)]),seen=new Set([...(target.manual||[]),...target.turns.flatMap(t=>t.messages||[])].map(m=>m.id)),deleted=new Set(target.deletedMessageIds||[]);
 const manualSource=source.turns.at(-1)?.signature===target.turns[source.turns.length-1]?.signature?source.manual:[];
 const candidates=[...manualSource.map(message=>({message,floor:source.turns.length-1})),...source.turns.flatMap((t,floor)=>t.signature===target.turns[floor]?.signature?(t.messages||[]).map(message=>({message,floor})):[])],out=[];
 for(const {message:m,floor} of candidates){if(!m||typeof m.id!=='string'||seen.has(m.id)||deleted.has(m.id)||m.recalled||!ids.has(m.roleId)||!['me','role'].includes(m.from)||!['text','voice'].includes(m.type||'text')||typeof m.text!=='string'||!m.text.trim()||m.text.length>4000||!Number.isFinite(m.created))continue;
 if(groupMembers[m.roleId]&&m.from==='role'&&!groupMembers[m.roleId].includes(m.speakerId))continue;
 const message={id:m.id,roleId:m.roleId,from:m.from,type:m.type||'text',text:m.text,created:m.created,status:m.from==='me'?'sent':undefined};
 for(const key of ['time','storyDate','speakerId','quoteId','editReason','editedAt','duration'])if(m[key]!==undefined)message[key]=m[key];out.push({message,floor});seen.add(m.id);
 }return out.sort((a,b)=>a.message.created-b.message.created);
}
export function applyRecoveredMessages(target,candidates){target.manual??=[];for(const {message,floor} of candidates){if(target.manual.some(m=>m.id===message.id))continue;target.manual.push(structuredClone(message));for(let i=floor+1;i<target.turns.length;i++){const before=target.turns[i].before;if(before){before.manual??=[];if(!before.manual.some(m=>m.id===message.id))before.manual.push(structuredClone(message));}}}target.manual.sort((a,b)=>a.created-b.created);}
