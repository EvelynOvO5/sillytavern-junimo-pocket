// IDs and deletion markers belong to one chat's metadata, never global settings.
function legacyId(m){const text=JSON.stringify([m.created,m.roleId,m.speakerId,m.from,m.type,m.text,m.mediaId]);let a=2166136261,b=5381;for(const c of text){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return 'legacy-'+(a>>>0).toString(36)+'-'+(b>>>0).toString(36);}
export function visibleMessages(s){return [...(s.manual||[]),...(s.turns||[]).flatMap(t=>t.messages||[])].map(m=>{m.id??=legacyId(m);return m;}).filter(m=>!(s.deletedMessageIds||[]).includes(m.id)).sort((a,b)=>a.created-b.created);}
export function quotedMessage(s,m){if(!m.quoteId)return undefined;const q=visibleMessages(s).find(q=>q.id===m.quoteId&&q.roleId===m.roleId);return q&&!q.recalled?{speaker:q.from==='me'?'用户':q.speakerId||q.roleId,text:q.text,type:q.type||'text'}:undefined;}
export function editMessage(s,id,text,reason=''){
 const m=visibleMessages(s).find(x=>x.id===id);
 if(!m||m.recalled||!['text','voice'].includes(m.type||'text'))throw Error('只能编辑尚未撤回的文字或语音文字');
 if(typeof text!=='string'||!text.trim()||text.trim().length>4000)throw Error('消息请填写1到4000字');
 if(typeof reason!=='string'||reason.trim().length>600)throw Error('编辑原因最多600字');
 const patch={text:text.trim(),editReason:reason.trim(),editedAt:Date.now()};
 if(m.type==='voice')patch.duration=Math.max(1,Math.min(180,Math.ceil(patch.text.length/4)));
 // Rewrite stored copies, including rollback checkpoints. Never retain rejected text.
 const visit=v=>{if(!v)return;for(const row of [...(v.manual||[]),...(v.messages||[])])if((row.id||legacyId(row))===id)Object.assign(row,{id},patch);for(const t of v.turns||[]){visit(t);visit(t.before);}visit(v.backup);visit(v.legacyBackup);visit(v.recordBackup);};
 visit(s);return m;
}
export function messageEditGuidance(s){
 const rows=visibleMessages(s).filter(m=>!m.recalled&&m.editReason).sort((a,b)=>a.editedAt-b.editedAt).slice(-30).map(m=>({threadId:m.roleId,speaker:m.from==='me'?'用户':m.speakerId||m.roleId,reason:m.editReason}));
 return rows.length?'【玩家消息编辑偏好】以下是玩家在编辑手机消息时留下的写作纠正，只约束对应聊天和发言者。后续措辞遵循这些原因，规避同类OOC。它们不是角色说过或听过的台词，不要在剧情里提到编辑操作。聊天记录以编辑后的版本为准。\n'+JSON.stringify(rows)+'\n【编辑偏好结束】':'';
}
export function removeMessage(s,id){const m=visibleMessages(s).find(m=>m.id===id);if(!m)return false;(s.deletedMessageIds??=[]).push(id);const scrub=v=>{if(!v)return;v.manual=(v.manual||[]).filter(x=>(x.id||legacyId(x))!==id);for(const t of v.turns||[]){t.messages=(t.messages||[]).filter(x=>(x.id||legacyId(x))!==id);scrub(t.before);}for(const e of v.socialEvents||[])if(e.id===id||e.id==='claim-'+id){if(v.draft?.actions)v.draft.actions=v.draft.actions.filter(a=>!a.includes(e.description));e.description='';} };scrub(s);scrub(s.backup);scrub(s.legacyBackup);return true;}
export function removePost(s,id){const posts=[...(s.posts||[]),...(s.turns||[]).flatMap(t=>t.posts||[])];if(!posts.some(p=>p.id===id))return false;(s.deletedPostIds??=[]).push(id);const scrub=v=>{if(!v)return;v.posts=(v.posts||[]).filter(p=>p.id!==id);for(const t of v.turns||[]){t.posts=(t.posts||[]).filter(p=>p.id!==id);scrub(t.before);}};scrub(s);scrub(s.backup);scrub(s.legacyBackup);return true;}

export function recallMessage(s,id,random=Math.random){const m=visibleMessages(s).find(x=>x.id===id);if(!m||m.from!=='me'||m.recalled||['gift','redpacket'].includes(m.type))throw Error('只能撤回自己的普通消息；红包和礼物已经结算，可删除记录');const seen=m.status==='sent'||random()<.5;m.recalled={seen,at:Date.now()};m.text=seen?'[用户撤回了一条消息；对方撤回前已看到：'+m.text+']':'[用户撤回了一条消息；对方没来得及看到内容]';m.type='recall';m.status='queued';for(const k of ['mediaId','stickerId','stickerName','quoteId','duration'])delete m[k];for(const t of s.turns||[])for(const old of t.before?.manual||[])if(old.id===id){for(const k of Object.keys(old))delete old[k];Object.assign(old,structuredClone(m));}return m;}
