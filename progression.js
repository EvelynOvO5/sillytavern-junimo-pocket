import {blueprintFormatRule} from './blueprint-rules.js';
export const skillNames=['耕种','采矿','采集','钓鱼','战斗'];
export const skillThresholds=[0,100,380,770,1300,2150,3300,4800,6900,10000,15000];
export const recipeCategories=['工业','食物','家具'];
const safe=(v,max=160)=>typeof v==='string'&&v.length<=max&&!/[<>]/.test(v);
const whole=(v,max=1000000)=>Number.isInteger(v)&&v>=0&&v<=max;
export function skillLevel(xp){return skillThresholds.findLastIndex(n=>xp>=n);}
export function validateProgress(p){
 if(p.player!==undefined){const v=p.player;if(!v||Array.isArray(v)||typeof v!=='object'||Object.keys(v).some(k=>!['outfit','skills'].includes(k)))throw Error('玩家状态格式无效');if(v.outfit!==undefined&&!safe(v.outfit,1200))throw Error('穿着描述无效');if(v.skills!==undefined&&(!v.skills||Array.isArray(v.skills)||Object.entries(v.skills).some(([k,n])=>!skillNames.includes(k)||!whole(n,15000))))throw Error('技能经验应为0到15000的累计整数');}
 for(const field of ['recipes','farmProjects'])if(p[field]!==undefined){if(!Array.isArray(p[field])||p[field].length>300)throw Error('图纸或工程数量无效');const names=new Set();for(const r of p[field]){if(!r||!safe(r.name,80)||!r.name.trim()||names.has(r.name))throw Error('图纸或工程名称重复或无效');names.add(r.name);if(!safe(r.source||'',300)||!safe(r.description||'',1200)||!whole(r.gold??0)||!Array.isArray(r.materials)||r.materials.length>30||r.materials.some(x=>!x||!safe(x.name,80)||!x.name||!whole(x.count)||x.count<1)||new Set(r.materials.map(x=>x.name)).size!==r.materials.length)throw Error('材料或图纸来源无效');if(field==='recipes'&&(!whole(r.gold)||!recipeCategories.includes(r.category)||!safe(r.product,80)||!r.product||!whole(r.quantity,99)||r.quantity<1||typeof r.learned!=='boolean'))throw Error('配方需要明确费用、分类、产物、数量和学习状态');if(field==='farmProjects'&&(!whole(r.days,112)||!['推荐','建设中','完成'].includes(r.status)))throw Error('工程需要工期和状态');}}
 return p;
}
export function mergeProgress(key,previous,value){if(key==='player')return {...previous,...value,skills:{...previous?.skills,...value.skills}};const map=new Map((previous||[]).map(r=>[r.name,r]));for(const r of value)map.set(r.name,r);return [...map.values()];}
export function materialText(materials){return materials.map(m=>m.name+'×'+m.count).join('、')||'无';}
export function parseMaterials(text){if(/^(?:未知|待定|不详|未确认|\?|？|N\/A)$/i.test(String(text||'').trim()))throw Error('图纸材料必须明确，不能写未知；无需材料才写无');if(!text||text==='无')return [];return text.split(/[、,，]/).map(s=>{const m=s.trim().match(/^(.+?)[×x*]\s*(\d+)$/);if(!m)throw Error('材料请写物品×数量');const name=m[1].trim();if(/^(?:未知|待定|不详|未确认|\?|？|N\/A)$/i.test(name))throw Error('材料物品名称不能写未知');return {name,count:+m[2]};});}
export function letterAttachments(letter){
 const recipes=[],warnings=[],body=[];
 for(const line of (letter.body||'').split('\n')){
  const m=line.trim().replace(/\*\*/g,'').match(/^图纸[：:]\s*(.+)$/);
  if(!m){body.push(line);continue;}
  let fields=m[1].split(/[|｜]/).map(x=>x.trim());
  // Older models sometimes merged the name and category, as in 木箱家具|木箱|1|…
  if(fields.length===8){const head=fields[0].match(/^(.+?)(工业|食物|家具)$/);if(head)fields=[head[1],head[2],...fields.slice(1)];}
  const [name,category,product,quantity,materials,gold,learned,source,...details]=fields;
  try{if(fields.length<9||!/^\d+$/.test(quantity)||!/^\d+$/.test(gold)||!materials||!['已学习','未学习'].includes(learned))throw Error('图纸配方必须完整');const r={name,category,product,quantity:Number(quantity),materials:parseMaterials(materials),gold:Number(gold),learned:false,source:source||'来信：'+letter.subject,description:details.join('｜')};validateProgress({recipes:[r]});if(!recipes.some(x=>x.name===r.name))recipes.push(r);}
  catch{warnings.push(name||'图纸');}
 }
 return {body:body.join('\n').trim(),recipes,warnings};
}
export function letterRecipes(letter){return letter.read?letterAttachments(letter).recipes.map(r=>({...r,learned:true})):[];}
export function craftTransaction(state,name,quantity){const r=(state.recipes||[]).find(r=>r.name===name);if(!r?.learned)throw Error('尚未学习这张图纸');if(!whole(quantity,99)||!quantity)throw Error('制作数量须为1到99');const items=r.materials.map(m=>{const owned=state.inventory.find(x=>x.name===m.name);if(!owned||owned.count<m.count*quantity)throw Error(m.name+'不足');return {...owned,count:-m.count*quantity};});const gold=(r.gold||0)*quantity;if(state.gold<gold)throw Error('金币不足');const product=state.inventory.find(x=>x.name===r.product)||{name:r.product,kind:'item',price:0,priceUnknown:true};items.push({...product,count:r.quantity*quantity});return {gold:-gold,items,description:'制作 '+r.product+' ×'+r.quantity*quantity+'（配方：'+r.name+'；已扣材料与费用）'};}
export function projectTransaction(state,name){const r=(state.farmProjects||[]).find(r=>r.name===name);if(!r||r.status!=='推荐')throw Error('项目已开工或不存在');const items=r.materials.map(m=>{const owned=state.inventory.find(x=>x.name===m.name);if(!owned||owned.count<m.count)throw Error(m.name+'不足');return {...owned,count:-m.count};});if(state.gold<(r.gold||0))throw Error('金币不足');return {gold:-(r.gold||0),items,description:'开工 '+name+'，工期 '+r.days+' 天，'+r.description+'（材料与金币已扣，正文按工期推进，不能再次扣费）'};}
export const progressionInstruction=`【制作、工程与成长同步】
只有已明确获得并学会的图纸才写已学习；食谱、家具、工业图纸可由来信、角色传授、购买或探索获得，允许原创。材料、产物、数量、费用必须明确，不明则先在故事里确认，不能猜配方。学会不等于制作，不增成品、不扣材料。所有栏目写在手机状态块内：
图纸：名称|工业或食物或家具|产物|单批数量|材料名×数量、材料名×数量（没有写无）|金币费用|已学习或未学习|来源|说明
工程：名称|推荐或建设中或完成|材料清单|金币费用|工期天数|来源|效果与前置条件
图纸和工程是按名称追加或更新，未提及的保留；已有名称必须保持稳定。推荐不扣费，手机开工已扣材料不能再扣。明确完工才更新工程为完成并更新建筑。
穿着：当前实际穿戴与配饰，不包含仅持有的衣服
技能：耕种或采矿或采集或钓鱼或战斗|累计经验总数
五项技能上限10级，累计经验等级阈值0/100/380/770/1300/2150/3300/4800/6900/10000/15000。按实际完成事件计一次：收获作物每株8经验，抚摸动物每天每只5耕种；采矿普通矿石每块5、宝石每块20；采集野外物品每件7、砍倒树每棵12；钓鱼每尾12、稀有鱼每尾30；战胜普通敌人每只10、强敌每只40。播种、浇水、购买、赠送、献祭、领取、重复阅读与未实施计划不加经验，制作不额外加经验。一次事件只能按对应技能计一次，不能把收获数量当行动次数再次翻倍。不凭等级送道具或自动学会图纸。经验是更新后的绝对总值，最高15000；换装或经验变化才写。`+'\n'+blueprintFormatRule;
