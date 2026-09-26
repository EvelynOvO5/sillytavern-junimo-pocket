import {clone,validatePatch} from './core.js';
export const TEXT_START='【手机状态】',TEXT_END='【状态结束】';
const regions={西部:'west',中心:'center',北部:'north',南部:'south',东部:'east'};
const stages={空地:'empty',播种:'seeded',生长:'growing',成熟:'mature'};
const empty=()=>({crop:'',days:null,wet:false,fertilizer:'',stage:'empty'});
const unknown=s=>/^(?:未知|未确认|不详|待定|暂无|无|[-—–－?？]+|N\/?A|null)?$/i.test(String(s??'').trim());
function numeric(value){const s=String(value??'').trim().replace(/[０-９]/g,c=>String(c.charCodeAt(0)-65296));const m=s.match(/^(?:第\s*)?(\d+(?:\.\d+)?)\s*(?:金币|金|g|格|个|枚|份|袋|点|天|日|年|%|％)?\s*(?:[（(][^()（）]*[）)])?$/i);if(!m)throw Error('数值格式错误：'+s);return Number(m[1]);}
function calendar(values,previous){const result={...previous};let clock=false,day=false;const rest=[];for(let i=0;i<values.length;i++){const token=values[i].normalize('NFKC').trim().replace(/^\s*(?:季节|日期|年份|天气|时刻)[：:]\s*/,'');let m;if((m=token.match(/^(春|夏|秋|冬)(?:季|天)?$/)))result.season=m[1]+'季';else if(/^(?:星期|周|礼拜)[一二三四五六日天1-7]$/.test(token))result.weekday=token;else if((m=token.match(/^(\d{1,2})[:：](\d{2})$/))){if(+m[1]>23||+m[2]>59)throw Error('时间须为有效的 HH:MM');result.time=m[1].padStart(2,'0')+':'+m[2];clock=true;}else if(/^第?\d+年$/.test(token))result.year=numeric(token);else if(/^第?\d+(?:日|天)$/.test(token)){result.day=numeric(token);day=true;}else if(/^\d+$/.test(token)){if(!day){result.day=numeric(token);day=true;}else result.year=numeric(token);}else if(token)rest.push(token);}if(!clock)throw Error('时间中缺少有效时刻，例如06:15');if(rest.length>1)throw Error('时间栏目无法区分：'+rest.join('、'));if(rest.length)result.weather=rest[0];return result;}
function resolvePlace(place,anchors,userName=''){
 const normalize=s=>String(s).normalize('NFKC').replace(/\s+/g,'').toLowerCase();const wanted=normalize(place),entries=Object.entries(anchors),candidates=[];
 for(const [name,spot] of entries){const aliases=[name,...(spot.aliases||[])];if(name==='你的牧场')aliases.push('你的农场','玩家农场','用户农场','用户牧场',...(userName?[userName+'农场',userName+'的农场',userName+'牧场',userName+'的牧场']:[]));if(name==='塞勒斯牧场工坊')aliases.push('塞勒斯牧场','塞勒斯农场');for(const alias of new Set(aliases.map(normalize)))if(alias.length>1)candidates.push({alias,spot,name});}
 const exact=candidates.filter(c=>c.alias===wanted);if(exact.length)return new Set(exact.map(c=>c.name)).size===1?exact[0].spot:undefined;
 const hits=[];for(const c of candidates){let i=wanted.indexOf(c.alias);while(i>=0){hits.push({...c,start:i,end:i+c.alias.length});i=wanted.indexOf(c.alias,i+1);}}
 // A specific place wins over a shorter alias inside it; two separate destinations stay ambiguous.
 const specific=hits.filter(h=>!hits.some(other=>other.start<=h.start&&other.end>=h.end&&other.alias.length>h.alias.length));return new Set(specific.map(h=>h.name)).size===1?specific[0].spot:undefined;
}
export function parseTextState(raw,state,{roles=[],anchors={},userName=''}={}){
 const start=raw.lastIndexOf(TEXT_START);if(start<0)return null;const end=raw.indexOf(TEXT_END,start);if(end<0)throw Error('文字状态摘要未写完');
 const patch={},lists=new Set(),warnings=[],invalidLists=new Set();const listKeys={背包:'inventory',任务:'quests',建筑:'buildings',动物:'animals',日程:'calendarEvents',农田:'plots'};const id=name=>{if(name==='维克托')name='维克多';const r=roles.find(r=>r.name===name||r.id===name);if(!r)throw Error('未收录的角色：'+name);return r.id;};
 const num=numeric;
 const list=(key,value)=>{if(!lists.has(key)){patch[key]=[];lists.add(key);}if(value)patch[key].push(value);};
 const segments=raw.slice(start+TEXT_START.length,end).replace(/<br\s*\/?\s*>/gi,'\n').split('\n').map(line=>line.trim().replace(/^[-*]\s+/,'').replace(/\*\*/g,''));
 const joined=[];
 const field=/^(时间|金币|容量|背包|农田|位置|好感|任务|建筑|动物|日程|记录)[：:]/;
 const fieldOnly=/^(时间|金币|容量|背包|农田|位置|好感|任务|建筑|动物|日程|记录)$/;
 for(const line of segments){
  if(!line||/^\x60\x60\x60/.test(line))continue;
  const last=joined.at(-1)||'',row=last.match(field);
  if(field.test(line)){joined.push(line);continue;}
  if(fieldOnly.test(last)){joined[joined.length-1]+=/^[：:]/.test(line)?line:'：'+line;continue;}
  if(fieldOnly.test(line)){joined.push(line);continue;}
  if(row){const year=row[1]==='时间'&&/^第?\d+年$/.test(line)&&!/[|｜第]$/.test(last);joined[joined.length-1]+=(year?'|':'')+line;}else joined.push(line);
 }
 const lines=joined.flatMap(clean=>{if(!/^背包[：:]/.test(clean))return [clean];return clean.replace(/^背包[：:]\s*/,'').split(/[,，;；]\s*(?=[^|｜,，;；]+[|｜]\s*\d)/).map(x=>'背包：'+x);});
 for(const rawLine of lines){const line=rawLine.trim();if(!line||/^```/.test(line))continue;const m=line.match(/^([^：:]+)[：:](.*)$/);if(!m){warnings.push('无法识别状态行：'+line);continue;}const key=m[1].trim(),v=m[2].split(/[|｜]/).map(x=>x.trim()),[a,b,c,d,e,f,g]=v;try{
 switch(key){
 case '时间':patch.calendar=calendar(v,state.calendar);break;
 case '金币':patch.gold=num(a);break;case '容量':patch.capacity=num(a);break;
 case '背包':list('inventory',a==='无'?null:{name:a,count:num(b),kind:({物品:'item',种子:'seed',肥料:'fertilizer'})[c]||(/种子$/.test(a)?'seed':'item'),price:unknown(d)?0:num(d),priceUnknown:unknown(d),days:unknown(e)?0:num(e)});break;
 case '农田':{if(a==='无'){patch.plots=state.plots.map((_,i)=>({index:i+1,...empty()}));break;}const range=a.match(/^(\d+)\s*[-~～至到]\s*(\d+)$/),first=range?+range[1]:num(a),last=range?+range[2]:first;if(!Number.isInteger(first)||!Number.isInteger(last)||first<1||last<first||last>120)throw Error('农田格号应在1到120之间');const bare=['无','空地','空'].includes(b);let plot;if(bare&&(c==='空地'||unknown(c)))plot=empty();else{if(!stages[c])throw Error('农田阶段应为播种、生长、成熟或空地');if(!['已浇','未浇'].includes(e))throw Error('农田浇水状态无效');plot={crop:bare?'':b,stage:stages[c],days:unknown(d)?null:num(d),wet:e==='已浇',fertilizer:unknown(f)?'':f};if(plot.stage==='empty'&&plot.crop)throw Error('空地不能含作物');if(plot.stage!=='empty'&&!plot.crop)throw Error('种植格缺少作物');if(plot.crop&&plot.stage!=='mature'&&plot.days===0)throw Error('未成熟作物天数不能为零');validatePatch({plots:[plot]});}for(let index=first;index<=last;index++)(patch.plots??=[]).push({index,...plot});break;}
 case '位置':{if(a===userName||/^(?:系统)?小爱(?:[（(]系统[）)])?$/.test(a))break;const roleId=id(a);let spot=resolvePlace(b,anchors,userName);if(!spot&&v.length===4)spot={region:regions[b]||b,x:num(c),y:num(d)};if(!spot)throw Error('未知地图地点：'+b);(patch.locations??={})[roleId]={region:spot.region,x:spot.x,y:spot.y};break;}
 case '好感':if(a==='无')break;(patch.relationships??={})[id(a)]=num(b);break;
 case '任务':list('quests',a==='无'?null:{name:a,status:b||'',...(!unknown(c)?{progress:num(c)}:{}),goal:d||'',reward:e||'',deadline:f||'',detail:g||''});break;
 case '动物':list('animals',a==='无'?null:{name:a,status:b||''});break;
 case '建筑':list('buildings',a==='无'?null:{name:a,status:b||'',...(!unknown(c)?{progress:num(c)}:{})});break;
 case '日程':list('calendarEvents',a==='无'?null:{name:a,season:b,day:num(c),detail:d||'',person:e==='无'?'':e||''});break;
 case '记录':patch.notes=v.join('｜');break;
 default:throw Error('未知状态栏目：'+key);
 }}catch(e){warnings.push(key+'：'+e.message);if(listKeys[key])invalidLists.add(listKeys[key]);}}
 for(const key of invalidLists)delete patch[key];for(const key of Object.keys(patch)){if(key==='plots')continue;try{validatePatch({[key]:patch[key]});}catch(e){delete patch[key];warnings.push(key+'：'+e.message);}}
 if(!Object.keys(patch).length&&warnings.length)throw Error(warnings.join('；'));return {version:1,patch,warnings};
}
export function formatState(state,roles=[],anchors={}){
 const s=clone(state),d=s.calendar,lines=[TEXT_START,`时间：${d.season}|${d.day}|${d.year}|${d.time}|${d.weather}|${d.weekday||''}`,`金币：${s.gold}`,`容量：${s.capacity}`];
 const add=(key,rows)=>lines.push(...(rows.length?rows.map(x=>key+'：'+x):[key+'：无']));
 add('背包',s.inventory.map(x=>[x.name,x.count,({item:'物品',seed:'种子',fertilizer:'肥料'})[x.kind||'item'],x.priceUnknown?'未知':x.price||0,x.days||'未知'].join('|')));
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
背包格式为名称|数量|物品或种子或肥料|单价|生长天数（未知写未知）。相邻多格内容一致时可合写，如“农田：1-15|防风草|播种|未知|未浇|无”，格号必须对应实际行动，不能自动重排。农田格式为格号|作物（空地写无）|播种或生长或成熟或空地|剩余天数（未知写未知）|已浇或未浇|肥料（没有写无）。播种不能成熟，只有成熟才天数0；空地天数写未知。所有农田清空才写“农田：无”。不修改没有发生的状态。
位置与好感仅输出以下名单中的角色，不要输出用户本人或系统小爱。每条状态写在同一个自然行内，绝不能把姓名、年份、地点拆到下一行；禁止逐字换行。角色名单：${roles.map(r=>r.name).join('、')}。位置只写角色现在所在的一个地点，不要把出发地、途经地或目的地并列写进位置栏。优先写地图标准地名，例如“位置：塞勒斯|你的牧场”；木桥旁、门口、房间等细节留在正文。用户姓名+农场/牧场均指你的牧场（例如林娇农场、林娇的牧场木桥旁），塞勒斯牧场属于塞勒斯牧场工坊，不能混淆。位置优先使用这些地点：${Object.keys(anchors).join('、')}；无匹配地点才写“位置：角色|西部或中心或北部或南部或东部|横坐标0到100|纵坐标0到100”。
当前还没有地图位置的角色：${roles.filter(r=>!state.locations?.[r.id]).map(r=>r.name).join('、')||'无'}。这些角色无论本轮是否出场，都必须依据世界书与时刻写一行初始位置；不能只写用户位置来替代。之后只写移动者。背包未知价格或天数写“未知”，不要把数量写成未知。
已确认状态（仅供参照，不要整段复制）：\n${formatState(state,roles,anchors)}`;}
