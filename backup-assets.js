import {validateImageSource} from './stickers.js';
import {sha256Bytes} from './browser-compat.js';
const hash=x=>sha256Bytes(new TextEncoder().encode(JSON.stringify(x)));
export function planAssetImport(existing,file,selected){
 const ids=new Set(selected),map={},add=[],known=new Map(existing.map(x=>[x.id,x]));
 for(const group of ['stickers','images'])if(ids.has(group)){
  const rows=file.data[group];if(!Array.isArray(rows)||rows.length>20000)throw Error('图片素材库格式无效');const seen=new Set();
  for(const input of rows){if(!input||typeof input.id!=='string'||!input.id||input.id.length>200||seen.has(input.id)||(input.category==='image')!==(group==='images')||typeof input.description!=='string'&&input.description!==undefined)throw Error('素材记录格式无效');seen.add(input.id);const item={...input,dataUrl:validateImageSource(input.dataUrl)};if(group==='stickers'&&(typeof item.name!=='string'||!item.name.trim()||item.name.length>40))throw Error('表情包名字无效');if((item.description||'').length>(group==='images'?1000:300))throw Error('素材说明过长');
   const old=known.get(item.id);if(old&&hash(old)!==hash(item)){const original=item.id;item.id='jp-import-'+hash(item).slice(0,32);map[original]=item.id;}
   if(known.has(item.id)){if(hash(known.get(item.id))!==hash(item))throw Error('素材 ID 冲突，请重新导出');continue;}known.set(item.id,item);add.push(item);
  }
 }
 if([...known.values()].filter(x=>x.category!=='image').length>100)throw Error('导入后表情包超过100个，请先整理或取消勾选表情包');
 return {add,map};
}
