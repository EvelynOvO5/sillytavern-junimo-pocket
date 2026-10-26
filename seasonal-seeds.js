import {farmClock} from './animals.js';
// Seasons and growth times follow 世界书补充/物品与获取.md. Prices are fixed shop balance values.
const rows=[
 ['防风草种子','春',20,4],['土豆种子','春',50,6],['青豆种子','春',60,10],['花椰菜种子','春',80,12],['草莓种子','春',100,8],['甘蓝种子','春',70,6],['大蒜种子','春',40,4],['胡萝卜种子','春',30,3],['燕麦种子','春秋',30,6],
 ['蓝莓种子','夏',80,13],['甜瓜种子','夏',80,12],['番茄种子','夏',50,11],['辣椒种子','夏',40,5],['啤酒花种子','夏',60,11],['黄瓜种子','夏',60,7],['杨桃种子','夏',400,13],['玉米种子','夏秋',150,14],['小麦种子','夏秋',10,4],
 ['南瓜种子','秋',100,13],['蔓越莓种子','秋',240,7],['茄子种子','秋',20,5],['山药种子','秋',60,10],['葡萄种子','秋',60,10],['苋菜种子','秋',70,7],['甜菜种子','秋',20,6],
 ['春季种子','春',35,7],['夏季种子','夏',55,7],['秋季种子','秋',45,7],['冬季种子','冬',30,7],
 ['郁金香花种','春',20,6],['蓝爵花种','春',30,7],['夏季亮片花种','夏',50,8],['向日葵花种','夏秋',200,8],['玫瑰仙子花种','秋',200,12],['玫瑰花种','春夏',80,8],['茉莉花种','夏',80,7],['兰花花种','春夏秋冬',120,14],
 ['月铃萝卜种子','春',80,6,'森林试种'],['银露苜蓿种子','春夏',100,7,'森林试种'],['萤芯莓种子','夏秋',120,10,'森林试种']
];
export function seasonalSeedProducts(state){const clock=farmClock(state?.calendar);if(!clock)return [];const season='春夏秋冬'[Math.floor(clock.day%112/28)];return rows.filter(([,seasons,,,quest])=>seasons.includes(season)&&(!quest||(state.quests||[]).some(q=>q.name?.includes(quest)&&['已完成','已结算'].includes(q.status)))).map(([name,,price,days])=>({id:'seasonal-seed-'+clock.day+'-'+name,seasonalSeed:true,item:{name,count:1,kind:'seed',price:Math.floor(price/2),days,quality:'普通'},price,stock:999,category:'seeds',description:name==='兰花花种'?'全年供应，需温室或室内种植，14天收获。':season+'季常备种子，'+days+'天首次成熟。'}));}
// The mandatory shelf reserves capacity before random products. Preserve today's remaining stock and IDs.
export function mergeSeasonalProducts(state,items,previous=[],limit=80){const fixed=seasonalSeedProducts(state),fixedByName=new Map(fixed.map(p=>[p.item.name,p])),random=[];for(const p of items){if(p.seasonalSeed)continue;const key=p.item.name;if(fixedByName.has(key)&&(p.item.quality||'普通')==='普通')continue;random.push(p);}
 const staples=fixed.map(p=>{const old=previous.find(x=>x.item.name===p.item.name&&(x.item.quality||'普通')==='普通');return old?{...p,id:old.id,stock:old.stock}:p;});return [...random.slice(0,Math.max(0,limit-staples.length)),...staples];}
