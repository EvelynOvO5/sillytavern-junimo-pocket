import {clone,validatePatch,applyPatch} from './core.js';
import {parseTextState,textStatePrompt} from './text-state.js';
export const START='<junimo-state>', END='</junimo-state>';
export function readStateBlock(raw,state,{roles=[],anchors={},initial=false}={}){
  const text=String(raw||''),start=text.lastIndexOf(START);
  let data=parseTextState(text,state,{roles,anchors});
  if(!data){if(start<0)return null;const end=text.indexOf(END,start);if(end<0)throw Error('正文变量块未写完，未更新手机');data=JSON.parse(text.slice(start+START.length,end).trim());}
  if(data.version!==1||!data.patch||typeof data.patch!=='object'||Array.isArray(data.patch))throw Error('正文变量块格式无效');
  const patch=clone(data.patch);
  if(patch.plots){const plots=clone(state.plots),seen=new Set();for(const p of patch.plots){if(!Number.isInteger(p.index)||p.index<1||p.index>120||seen.has(p.index))throw Error('农田格号无效或重复');seen.add(p.index);if(!['empty','seeded','growing','mature'].includes(p.stage))throw Error('农田必须标注 empty/seeded/growing/mature 阶段');if(p.stage==='empty'&&p.crop)throw Error('空地不能含作物');if(p.stage!=='empty'&&!p.crop)throw Error('种植格缺少作物');if(p.stage!=='mature'&&p.crop&&p.days===0)throw Error('未成熟作物的剩余天数不能为零');while(plots.length<p.index)plots.push({crop:'',days:null,wet:false,fertilizer:'',stage:'empty'});const {index,...value}=p;plots[index-1]={...value,days:p.stage==='mature'?0:p.days};}patch.plots=plots;}
  if(initial){for(const key of ['calendar','inventory','plots','locations'])if(!(key in data.patch))throw Error('首次变量块缺少 '+key);for(const r of roles)if(!patch.locations?.[r.id])throw Error('首次变量块缺少 '+r.name+' 的地图位置');}
  validatePatch(patch);return {patch,state:applyPatch(state,patch)};
}
export function statePrompt(state,roles,anchors,initial){return textStatePrompt(state,roles,anchors,initial);}
export function parseBubbles(raw){let result;try{result=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{result={bubbles:raw.split(/\n\s*\n/)};}const bubbles=Array.isArray(result)?result:result.bubbles;if(!Array.isArray(bubbles)||bubbles.length<1||bubbles.length>8||bubbles.some(x=>typeof x!=='string'||!x.trim()||x.length>2000))throw Error('手机回复气泡格式不正确');return bubbles.map(x=>x.trim());}
