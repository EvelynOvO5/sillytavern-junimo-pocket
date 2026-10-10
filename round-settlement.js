import {plotView,advancedFarmDay} from './farm-state.js';
export const questCompleted=q=>/^(?:已完成|完成|已结算|已领取|已交付|completed)(?:$|[（( ·：:,，。;；/、]|待领取)/i.test(String(q?.status||'').trim());
export function questRows(quests=[]){return {active:quests.map((q,index)=>({q,index})).filter(x=>!questCompleted(x.q)),completed:quests.map((q,index)=>({q,index})).filter(x=>questCompleted(x.q))};}
export const repairFields={背包:['inventory','capacity','gold','player'],农田:['plots','inventory'],农场:['buildings','farmProjects'],制作:['recipes'],日历:['calendar','calendarEvents'],地图:['locations'],任务:['quests','gold','inventory','relationships','recipes','player'],聊天:['relationships'],全部:null};
export function repairPatch(scope,patch){if(!(scope in repairFields))throw Error('未知校正范围');const fields=repairFields[scope];return fields?Object.fromEntries(Object.entries(patch).filter(([key])=>fields.includes(key))):patch;}
export function settleActionDraft(current,submitted,before,after,{consumeNonFarm=true,conflicts=[]}={}){
 if(!current?.actions?.length)return null;
 const submittedActions=[...(submitted?.actions||[])];
 const remaining=current.actions.filter(action=>{const submittedIndex=submittedActions.indexOf(action),wasSubmitted=submittedIndex>=0;if(wasSubmitted)submittedActions.splice(submittedIndex,1);
 const match=action.match(/第\s*(\d+)\s*格/);if(match&&/播种|浇水|施用|收获|铲除|耕地/.test(action)){if(wasSubmitted&&conflicts.length)return true;const index=+match[1]-1;if(!after.plots?.[index])return true;const wanted=plotView(current.plots?.[index]),actual=plotView(after.plots?.[index]);if(wanted.crop!==actual.crop)return true;if(/浇水/.test(action)&&wanted.wet&&!actual.wet&&!advancedFarmDay(before,after))return true;if(/施用/.test(action)&&wanted.fertilizer!==actual.fertilizer)return true;return false;}
 const task=action.match(/^完成任务[：:]\s*(.+)$/);if(task)return !(after.quests||[]).some(q=>q.name===task[1]&&questCompleted(q));
 return !(wasSubmitted&&consumeNonFarm);
 });
 if(!remaining.length)return null;const pendingIndexes=new Set(remaining.flatMap(a=>{const m=a.match(/第\s*(\d+)\s*格/);return m?[+m[1]-1]:[];}));const plots=after.plots.map((p,i)=>pendingIndexes.has(i)?structuredClone(current.plots[i]||p):structuredClone(p));return {...current,actions:remaining,plots,conflicts:conflicts.length?conflicts:[]};
}
export const questSettlementRule='【任务完成与奖励结算】任务状态与奖励入账是两件事。状态使用进行中、已完成（待领取）或已结算等明确标记。正文明确完成任务时，手机摘要必须更新任务状态；已完成任务由手机归档，不得再次提交。正文明确领取奖励时，状态写已结算，并同时输出奖励涉及的金币、完整背包、好感或已学图纸等更新后的绝对值。不能只改任务状态而遗漏奖励。未领取或奖励内容不明时写已完成（待领取），不得猜奖励或把未知报酬变成0。领取图纸遵守完整配方规则。当前状态已包含的奖励不可再加，手机委托已通过交付入账的不可重复领取。带指令校正任务时，允许同步修正该任务的状态及已经确认应结算的奖励字段；按当前基线、最近正文和交易记录核对，只补漏掉的结算，不重发已领取奖励，不改变无关项目。';
