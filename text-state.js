import {clone} from './core.js';
export const TEXT_START='【手机状态】',TEXT_END='【状态结束】';
const regions={西部:'west',中心:'center',北部:'north',南部:'south',东部:'east'};
const stages={空地:'empty',播种:'seeded',生长:'growing',成熟:'mature'};
const empty=()=>({crop:'',days:null,wet:false,fertilizer:'',stage:'empty'});
const unknown=s=>/^(?:未知|未确认|不详|待定|无|—|-|null)?$/i.test(String(s??'').trim());
function numeric(value){const s=String(value??'').trim().replace(/[０-９]/g,c=>String(c.charCodeAt(0)-65296));const m=s.match(/^(?:第\s*)?(\d+(?:\.\d+)?)\s*(?:金币|金|g|格|个|枚|份|袋|点|天|日|年|%|％)?\s*(?:[（(][^()（）]*[）)])?$/i);if(!m)throw Error('数值格式错误：'+s);return Number(m[1]);}
function calendar(values,previous){const result={...previous};let clock=false,day=false;const rest=[];for(let i=0;i<values.length;i++){const token=values[i].trim().replace(/^\s*(?:季节|日期|年份|天气|时刻)[：:]\s*/,'');let m;if((m=token.match(/^(春|夏|秋|冬)(?:季|天)?$/)))result.season=m[1]+'季';else if(/^(?:星期|周|礼拜)[一二三四五六日天1-7]$/.test(token))result.weekday=token;else if((m=token.match(/^(\d{1,2})[:：](\d{2})$/))){if(+m[1]>23||+m[2]>59)throw Error('时间须为有效的 HH:MM');result.time=m[1].padStart(2,'0')+':'+m[2];clock=true;}else if(/^第?\d+年$/.test(token))result.year=numeric(token);else if(/^第?\d+(?:日|天)$/.test(token)){result.day=numeric(token);day=true;}else if(/^\d+$/.test(token)){if(!day){result.day=numeric(token);day=true;}else result.year=numeric(token);}else if(token)rest.push(token);}if(!clock)throw Error('时间中缺少有效时刻，例如06:15');if(rest.length>1)throw Error('时间栏目无法区分：'+rest.join('、'));if(rest.length)result.weather=rest[0];return result;}
function resolvePlace(place,anchors){const exact=Object.entries(anchors).find(([name,p])=>name===place||p.aliases?.includes(place));if(exact)return exact[1];const base=place.replace(/(?:[一二三四五六七八九十\d]+楼|楼上|楼下|门口|门外|门前|内部|内|外)$/,'');return Object.entries(anchors).find(([name,p])=>name===base||p.aliases?.includes(base))?.[1];}
export function parseTextState(raw,state,{roles=[],anchors={}}={}){
 const start=raw.lastIndexOf(TEXT_START);if(start<0)return null;const end=raw.indexOf(TEXT_END,start);if(end<0)throw Error('文字状态摘要未写完');
 const patch={},lists=new Set();const id=name=>{const r=roles.find(r=>r.name===name||r.id===name);if(!r)throw Error('未知角色：'+name);return r.id;};
 const num=numeric;
 const list=(key,value)=>{if(!lists.has(key)){patch[key]=[];lists.add(key);}if(value)patch[key].push(value);};
 const lines=raw.slice(start+TEXT_START.length,end).split('\n').flatMap(line=>{const clean=line.trim().replace(/^[-*]\s+/,'').replace(/\*\*/g,'');if(!/^背包[：:]/.test(clean))return [clean];return clean.replace(/^背包[：:]\s*/,'').split(/[,，;；]\s*(?=[^|｜,，;；]+[|｜]\s*\d)/).map(x=>'背包：'+x);});
 for(const rawLine of lines){const line=rawLine.trim();if(!line||/^```/.test(line))continue;const m=line.match(/^([^：:]+)[：:](.*)$/);if(!m)throw Error('无法识别状态行：'+line);const key=m[1].trim(),v=m[2].split(/[|｜]/).map(x=>x.trim()),[a,b,c,d,e,f,g]=v;
 switch(key){
 case '时间':patch.calendar=calendar(v,state.calendar);break;
 case '金币':patch.gold=num(a);break;case '容量':patch.capacity=num(a);break;
 case '背包':list('inventory',a==='无'?null:{name:a,count:num(b),kind:({物品:'item',种子:'seed',肥料:'fertilizer'})[c]||'item',price:num(d||'0'),days:e==='未知'?0:num(e||'0')});break;
 case '农田':if(a==='无'){patch.plots=state.plots.map((_,i)=>({index:i+1,...empty()}));break;}if(!stages[c])throw Error('农田阶段应为播种、生长、成熟或空地');if(!['已浇','未浇'].includes(e))throw Error('农田浇水状态无效');(patch.plots??=[]).push({index:num(a),crop:b==='无'?'':b,stage:stages[c],days:d==='未知'?null:num(d),wet:e==='已浇',fertilizer:f==='无'?'':f||''});break;
 case '位置':{let spot=resolvePlace(b,anchors);if(!spot&&v.length===4)spot={region:regions[b]||b,x:num(c),y:num(d)};if(!spot)throw Error('未知地图地点：'+b);(patch.locations??={})[id(a)]={region:spot.region,x:spot.x,y:spot.y};break;}
 case '好感':(patch.relationships??={})[id(a)]=num(b);break;
 case '任务':list('quests',a==='无'?null:{name:a,status:b||'',...(!unknown(c)?{progress:num(c)}:{}),goal:d||'',reward:e||'',deadline:f||'',detail:g||''});break;
 case '动物':list('animals',a==='无'?null:{name:a,status:b||''});break;
 case '建筑':list('buildings',a==='无'?null:{name:a,status:b||'',...(!unknown(c)?{progress:num(c)}:{})});break;
 case '日程':list('calendarEvents',a==='无'?null:{name:a,season:b,day:num(c),detail:d||'',person:e==='无'?'':e||''});break;
 case '记录':patch.notes=v.join('｜');break;
 default:throw Error('未知状态栏目：'+key);
 }}return {version:1,patch};
}
export function formatState(state,roles=[],anchors={}){
 const s=clone(state),d=s.calendar,lines=[TEXT_START,`时间：${d.season}|${d.day}|${d.year}|${d.time}|${d.weather}|${d.weekday||''}`,`金币：${s.gold}`,`容量：${s.capacity}`];
 const add=(key,rows)=>lines.push(...(rows.length?rows.map(x=>key+'：'+x):[key+'：无']));
 add('背包',s.inventory.map(x=>[x.name,x.count,({item:'物品',seed:'种子',fertilizer:'肥料'})[x.kind||'item'],x.price||0,x.days||'未知'].join('|')));
 add('农田',s.plots.flatMap((x,i)=>x.crop?[[i+1,x.crop,({seeded:'播种',growing:'生长',mature:'成熟'})[x.stage]||(x.days===0?'成熟':'生长'),x.days??'未知',x.wet?'已浇':'未浇',x.fertilizer||'无'].join('|')]:[]));
 for(const r of roles){const p=s.locations[r.id];if(p){const place=Object.entries(anchors).find(([,a])=>a.region===p.region&&a.x===p.x&&a.y===p.y)?.[0];lines.push('位置：'+r.name+'|'+(place||[Object.keys(regions).find(k=>regions[k]===p.region)||p.region,p.x,p.y].join('|')));}lines.push('好感：'+r.name+'|'+(s.relationships[r.id]||0));}
 add('任务',(s.quests||[]).map(x=>[x.name,x.status,x.progress||0,x.goal||'',x.reward||'',x.deadline||'',x.detail||''].join('|')));add('建筑',(s.buildings||[]).map(x=>[x.name,x.status,x.progress||0].join('|')));add('动物',(s.animals||[]).map(x=>[x.name,x.status].join('|')));add('日程',(s.calendarEvents||[]).map(x=>[x.name,x.season,x.day,x.detail||'',x.person||'无'].join('|')));if(s.notes)lines.push('记录：'+s.notes.replace(/\n/g,' '));lines.push(TEXT_END);return lines.join('\n');
}
export function textStatePrompt(state,roles,anchors,initial){return `【手机文字状态摘要规则】
在正文最后附上简短文字摘要，以${TEXT_START}开始、${TEXT_END}结束。禁止 JSON、代码块或逐个列出空地。每行一个栏目，字段用 | 分隔，字段内不写换行或 |。未变化的栏目不写；列表栏目（背包/任务/动物/建筑/日程）一旦变化须列完整列表，为空仅写“栏目：无”。位置、好感、农田只写变化的角色或格子，所有数值是变化后的绝对值。
${initial?'首次初始化必须写时间、背包、农田和全部角色位置，并写已建立的好感。未种植只写“农田：无”，绝不能枚举空地。依据世界书和本轮时间设定未出场角色位置。':'保留未改变的值，不要每轮列全部角色和空地。'}
每一轮都必须复核并输出“时间”。时间为故事时间，不是电脑时钟；谈话、走路、劳动都应按正文实际耗时推进分钟，跨日同步日期。明确无时间流逝才保持不变，禁止一直机械沿用开场06:00，也不能无依据跳过几小时。
每轮检查参与互动角色对用户的好感变化，依据世界书和互动质量小幅增减，输出更新后0到2500的总点数（不是增量）。未互动角色不变，不能无理由全员增加。正负互动都应反映，不要一直遗漏好感栏。
时间字段写明日、年，星期不能当成年份；年份不确定可省略。每件背包物品单独一行，不要用逗号挤在同一行。任务或建筑进度不确定写未知。
格式示例（值按正文填写，未变化可省略）：
时间：春季|1日|星期一|06:15|晴|第1年
金币：500
容量：24
背包：草莓种子|2|种子|10|8
农田：1|草莓|播种|8|已浇|无
位置：哈兰|邮局
好感：哈兰|15
任务：初次播种|进行中|50|播种两格|100金币|今天|任务详情
动物：鸡|已喂食
建筑：鸡舍|建设中|20
日程：花舞节|春季|24|前往森林|无
记录：今天结识了新朋友
背包格式为名称|数量|物品或种子或肥料|单价|生长天数（未知写未知）。农田格式为格号|作物（空地写无）|播种或生长或成熟或空地|剩余天数（未知写未知）|已浇或未浇|肥料（没有写无）。播种不能成熟，只有成熟才天数0；空地天数写未知。所有农田清空才写“农田：无”。不修改没有发生的状态。
角色名单：${roles.map(r=>r.name).join('、')}。位置优先使用这些地点：${Object.keys(anchors).join('、')}；无匹配地点才写“位置：角色|西部或中心或北部或南部或东部|横坐标0到100|纵坐标0到100”。
已确认状态（仅供参照，不要整段复制）：\n${formatState(state,roles,anchors)}`;}
