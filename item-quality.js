export const qualities=Object.freeze(['普通','银星','金星','紫星']);
export const qualityMultipliers=Object.freeze({普通:1,银星:1.25,金星:1.5,紫星:2});
export function normalizeQuality(value){if(value===undefined||value===null||value==='')return '普通';const aliases={无:'普通',无星:'普通',normal:'普通',silver:'银星',gold:'金星',iridium:'紫星',铱星:'紫星'};const q=aliases[value]||value;if(!qualities.includes(q))throw Error('品质应为普通、银星、金星或紫星');return q;}
export function itemKey(item){return JSON.stringify([String(item.name||'').normalize('NFKC').trim(),normalizeQuality(item.quality)]);}
export function sameItem(a,b){return itemKey(a)===itemKey(b);}
export function itemLabel(item){const q=normalizeQuality(item.quality);return item.name+(q==='普通'?'':'（'+q+'）');}
export function itemCount(inventory,item){return (inventory||[]).filter(x=>sameItem(x,item)).reduce((n,x)=>n+x.count,0);}
export function takeItems(inventory,name,count,quality){if(!Number.isInteger(count)||count<1)throw Error('物品数量无效');let left=count;const out=[];const stacks=(inventory||[]).filter(x=>x.name===name&&(quality===undefined||normalizeQuality(x.quality)===normalizeQuality(quality))).sort((a,b)=>qualities.indexOf(normalizeQuality(a.quality))-qualities.indexOf(normalizeQuality(b.quality)));for(const item of stacks){const used=Math.min(left,item.count);if(used>0)out.push({...item,count:-used});left-=used;if(!left)break;}if(left)throw Error(name+'数量不足');return out;}
export const qualityStateRule='【物品品质】背包：名称|剩余总数|物品或种子或肥料|该品质单价|生长天数或未知|普通或银星或金星或紫星。同名不同品质分别一行，品质不写进物品名称；数量0只删除对应品质。单价写该品质实际售价，不由手机猜倍率。没有品质的工具、材料、种子等写普通。经验事件：类型|实际数量|对象名称|本轮正文原句|品质。不同品质分行；不明品质不凭空升级。';

export function itemQualityMarkup(item){const quality=normalizeQuality(item.quality);if(quality==='普通')return '';const tone={银星:'silver',金星:'gold',紫星:'purple'}[quality];return '<span class="jp-quality-star jp-quality-'+tone+'" role="img" aria-label="'+quality+'" title="'+quality+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z"/></svg></span>';}
