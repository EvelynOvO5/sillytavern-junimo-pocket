import {itemCategories} from './collection.js';
const text=(v,n)=>typeof v==='string'&&v.length<=n&&!/[<>]/.test(v);
export function correctionPatch(scope,data,source){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('校正结果须为对象');
 const key=scope==='动物'?'animals':scope==='图鉴'?'categories':'posts';
 const allowed=scope==='朋友圈'?['posts','comments']:[key];if(Object.keys(data).some(k=>!allowed.includes(k)))throw Error('校正越过了所选范围');const out={};
 for(const field of allowed){const rows=data[field]||[];if(!Array.isArray(rows)||rows.length>300)throw Error('校正列表无效');const seen=new Set();out[field]=rows.map(v=>{const id=field==='categories'?v.name:v.id,original=(source[field]||[]).find(x=>(field==='categories'?x.name:x.id)===id);if(!original||seen.has(id))throw Error('不能增加、删除或重复未知记录');seen.add(id);
 if(field==='animals'){const fields=['age','friendship','mood','fed','pet','outside'];if(Object.keys(v).some(k=>!['id',...fields].includes(k)))throw Error('动物校正仅支持年龄、友谊、心情与照料状态');for(const k of ['age','friendship','mood'])if(v[k]!==undefined&&(!Number.isFinite(v[k])||v[k]<0||v[k]>{age:9999,friendship:1000,mood:255}[k]))throw Error('动物数值超出范围');for(const k of ['fed','pet','outside'])if(v[k]!==undefined&&typeof v[k]!=='boolean')throw Error('照料状态须为布尔值');return {...original,...v};}
 if(field==='categories'){if(!itemCategories.includes(v.category)||Object.keys(v).some(k=>!['name','category'].includes(k)))throw Error('图鉴分类无效');return {name:v.name,category:v.category};}
 if(original.authorId==='me')throw Error('这里不会改写用户自己发布的动态或评论');if(Object.keys(v).some(k=>!(field==='posts'?['id','text','imageDescription']:['id','text']).includes(k))||!text(v.text,600)||!v.text.trim()||(v.imageDescription!==undefined&&!text(v.imageDescription,1000)))throw Error('动态文字无效');return {...original,...v};});}
 return out;
}
