import {clone,validatePatch,applyPatch} from './core.js';
export const START='<junimo-state>', END='</junimo-state>';
export function readStateBlock(raw,state,{roles=[],initial=false}={}){
  const text=String(raw||''),start=text.lastIndexOf(START);if(start<0)return null;
  const end=text.indexOf(END,start);if(end<0)throw Error('正文变量块未写完，未更新手机');
  const data=JSON.parse(text.slice(start+START.length,end).trim());
  if(data.version!==1||!data.patch||typeof data.patch!=='object'||Array.isArray(data.patch))throw Error('正文变量块格式无效');
  const patch=clone(data.patch);
  if(patch.plots){const plots=clone(state.plots),seen=new Set();for(const p of patch.plots){if(!Number.isInteger(p.index)||p.index<1||p.index>120||seen.has(p.index))throw Error('农田格号无效或重复');seen.add(p.index);if(!['empty','seeded','growing','mature'].includes(p.stage))throw Error('农田必须标注 empty/seeded/growing/mature 阶段');if(p.stage==='empty'&&p.crop)throw Error('空地不能含作物');if(p.stage!=='empty'&&!p.crop)throw Error('种植格缺少作物');if(p.stage!=='mature'&&p.crop&&p.days===0)throw Error('未成熟作物的剩余天数不能为零');while(plots.length<p.index)plots.push({crop:'',days:null,wet:false,fertilizer:'',stage:'empty'});const {index,...value}=p;plots[index-1]={...value,days:p.stage==='mature'?0:p.days};}patch.plots=plots;}
  if(initial){for(const key of ['calendar','inventory','plots','locations'])if(!(key in data.patch))throw Error('首次变量块缺少 '+key);for(const r of roles)if(!patch.locations?.[r.id])throw Error('首次变量块缺少 '+r.name+' 的地图位置');}
  validatePatch(patch);return {patch,state:applyPatch(state,patch)};
}
export function statePrompt(state,roles,anchors,initial){return `【月亮谷手机变量协议：这是正文生成要求】
正文照常演绎，最后必须额外输出且仅输出一个 ${START}{"version":1,"patch":{...}}${END} 块。使用严格 JSON，不放进思维链，不省略结束标签，不用 HTML 展示变量。
${initial?'这是首次初始化：输出完整 calendar、inventory、plots 和所有角色 locations。依据角色世界书的居所/工作地点与开场时刻，为每个角色设定本次故事的初始位置（包括未出场角色）。不要给用户添加正文未获得的物品、动物或已建设设施。':'只输出本轮发生变化的字段，未提供的字段保持原值；角色位置只输出移动的角色。'}
所有数值为更新后的绝对值。禁止因为播种而成熟，禁止无依据推进日期或减少生长天数。播种必须 stage=seeded，days 为实际剩余天数，未知用 null；仅正文明确成熟时 stage=mature。空地 stage=empty,crop="",days=null。plots 是逐格改动数组，每项含 index（1起）、crop、stage、days、wet（是否浇水）、fertilizer；没有改动不输出。inventory/quests/animals/buildings/calendarEvents 一旦输出就提供完整列表（空列表表示清空）。金币不能负数。
字段定义：gold:金币,capacity:背包格数,calendar:{season,day,year,time,weather,weekday},inventory:[{name,count,price,kind:"item|seed|fertilizer",days:种子生长天数或0}],plots:[{index,crop,stage:"empty|seeded|growing|mature",days,wet,fertilizer}],locations:{角色ID:{region:"west|center|north|south|east",x:0到100,y:0到100}},relationships:{角色ID:0到2500},quests:[{name,status,detail,goal,reward,deadline,progress:0到100}],calendarEvents:[{name,day,season,detail,person:生日角色名或空字符串}],animals:[{name,status}],buildings:[{name,status,progress:0到100}],notes:农场记录。不输出其他字段，不在这里生成手机聊天。
角色ID：${JSON.stringify(roles)}
地图地标坐标（尽量使用地标，邻近角色可稍微错开避免头像重叠）：${JSON.stringify(anchors)}
上轮已确认手机状态：${JSON.stringify(state)}
请在输出前检查：物品数量、播种阶段、时间推进、所有字段的 JSON 类型。`}
export function parseBubbles(raw){let result;try{result=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{result={bubbles:raw.split(/\n\s*\n/)};}const bubbles=Array.isArray(result)?result:result.bubbles;if(!Array.isArray(bubbles)||bubbles.length<1||bubbles.length>8||bubbles.some(x=>typeof x!=='string'||!x.trim()||x.length>2000))throw Error('手机回复气泡格式不正确');return bubbles.map(x=>x.trim());}
