import {applyPatch} from './core.js';
import {repairFields} from './round-settlement.js';
import {applyNarrativeSkills,applySkillDeltas,normalizeSkillEvent} from './skill-accounting.js';
import {storyText} from './story-sync.js';
const clean=text=>String(text||'').replace(/<[^>]*>/g,'').replace(/\s+/g,'');
export function preparePlayerRepair(s,base,patch,events,chat,scope='全部'){
 const work={...s,skillEventLog:structuredClone(s.skillEventLog||[])};let state=applyPatch(base,patch);const warnings=[],earned=[];
 if(repairFields[scope]&& !repairFields[scope].includes('player'))return {state,warnings,earned,skillEventLog:work.skillEventLog};
 for(const raw of events||[]){
  let event;try{event=normalizeSkillEvent(raw);}catch(e){warnings.push(e.message);continue;}
  const evidence=clean(event.evidence),floors=[];
  for(let i=s.skillAccountingStartFloor||0;i<chat.length;i++){const m=chat[i];if(m.is_user||m.is_system)continue;const narrative=storyText(m.mes).split(/【手机状态】|<junimo-state>/)[0];if(evidence&&clean(narrative).includes(evidence))floors.push(i);}
  if(floors.length!==1){warnings.push(floors.length?'经验依据对应多个楼层，未重复计分':'经验依据未对应到实际正文，未计分');continue;}
  const floor=floors[0],calendar=state.calendar,result=applyNarrativeSkills(work,{...state,calendar:s.turns[floor]?.state?.calendar||calendar},[event],{floor,narrative:storyText(chat[floor].mes).split(/【手机状态】|<junimo-state>/)[0]});
  state={...result.state,calendar};warnings.push(...result.warnings);earned.push(...result.earned);
 }
 return {state,warnings,earned,skillEventLog:work.skillEventLog};
}
export function commitPlayerRepair(s,result){
 s.skillEventLog=structuredClone(result.skillEventLog);
 for(const event of result.earned){
  for(let i=event.floor;i<(s.turns||[]).length;i++)if(s.turns[i]?.state){s.turns[i].state=applySkillDeltas(s.turns[i].state,{[event.skill]:event.xp});s.turns[i].playerCorrectionSnapshot=true;}
  for(let i=event.floor+1;i<(s.turns||[]).length;i++){const before=s.turns[i]?.before;if(before){before.skillEventLog??=[];if(!before.skillEventLog.some(e=>e.key===event.key))before.skillEventLog.push(structuredClone(event));}}
 }
}
export const playerRepairInstruction='校正穿着时把正文明确的当前衣物与配饰写为“穿着：具体内容”；只写在记录或说明里无法更新穿着。校正经验时输出“经验事件：事件类型|实际数量|对象|对应正文原句|普通或银星或金星或紫星”，由手机计分；不以正文宣称的等级代替实际事件，依据必须来自实际正文而非用户要求。';
