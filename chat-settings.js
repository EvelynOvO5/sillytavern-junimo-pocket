export function chatDisplayName(names,role,thread){
 if(thread?.members)return names?.[thread.id]?.members?.[role.id]||names?.[role.id]?.name||role.name;
 return names?.[role.id]?.name||role.name;
}
export function updateChatNames(current,thread,value,roles){
 if(!thread||!value||typeof value!=='object'||Array.isArray(value))throw Error('备注设置无效');
 const clean=v=>{if(typeof v!=='string'||v.trim().length>32)throw Error('备注最多32字');return v.trim();};
 if(Object.keys(value).some(k=>!['name','members'].includes(k)))throw Error('备注字段无效');
 const next=structuredClone(current||{}),entry={...next[thread.id]};
 if(value.name!==undefined)entry.name=clean(value.name);
 if(value.members!==undefined){if(!thread.members||!value.members||typeof value.members!=='object'||Array.isArray(value.members))throw Error('成员备注无效');entry.members={...entry.members};for(const [id,n] of Object.entries(value.members)){if(!thread.members.includes(id)||!roles.some(r=>r.id===id))throw Error('成员不存在');entry.members[id]=clean(n);}}
 next[thread.id]=entry;return next;
}
export function shouldMarkChatRead({phoneOpen,appActive,roomHidden,activeId},id){return !!phoneOpen&&!!appActive&&!roomHidden&&activeId===id;}
export function migrateOutputLimits(cfg){if(cfg.outputBudgetVersion===1)return false;if(cfg.maxTokens==null||cfg.maxTokens===2200)cfg.maxTokens=6000;if(cfg.mailTokens==null||cfg.mailTokens===6000)cfg.mailTokens=8000;if(cfg.repairTokens==null)cfg.repairTokens=12000;cfg.outputBudgetVersion=1;return true;}
