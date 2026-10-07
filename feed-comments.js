import {parseResponseJSON} from './json-response.js';
export function commentsFor(s,postId){return [...(s.comments||[]),...(s.turns||[]).flatMap(t=>t.comments||[])].filter(c=>c.postId===postId&&!(s.deletedCommentIds||[]).includes(c.id)).sort((a,b)=>a.created-b.created);}
export function newComment(postId,authorId,text,replyTo){text=String(text||'').trim();if(!text||text.length>500)throw Error('评论请填写1到500字');return {id:crypto.randomUUID(),postId,authorId,text,...(replyTo?{replyTo}:{}),created:Date.now()};}
export function parseComments(raw,posts,roles,existing=[],{tolerant=false,warnings=[]}={}){
 const data=parseResponseJSON(raw);if(!Array.isArray(data.comments)||data.comments.length>4)throw Error('评论格式无效');
 const accepted=[],pending=[],aliases=new Map();
 for(const c of data.comments){try{
  if(!c||!posts.some(p=>p.id===c.postId)||!roles.some(r=>r.id===c.authorId))throw Error('评论的动态或角色无效');
  const row=newComment(c.postId,c.authorId,c.text);pending.push({input:c,row});
  if(typeof c.id==='string'&&c.id&&!existing.some(x=>x.id===c.id)&&!aliases.has(c.id))aliases.set(c.id,row);
 }catch(e){if(!tolerant)throw e;warnings.push(e.message);}}
 const waiting=[...pending];
 for(let pass=0;pass<=pending.length&&waiting.length;pass++)for(let i=0;i<waiting.length;){
  const {input:c,row}=waiting[i],target=c.replyTo;
  if(!target||['无','null','undefined','none',''].includes(String(target).trim().toLowerCase())||target===c.postId){accepted.push(row);waiting.splice(i,1);continue;}
  const direct=existing.concat(accepted).find(x=>x.id===target&&x.postId===row.postId),alias=aliases.get(target);
  let parent=direct||(alias&&accepted.includes(alias)&&alias.postId===row.postId?alias:null);
  if(!parent&&!alias){const matches=existing.filter(x=>x.postId===row.postId&&(x.authorId===target||roles.find(r=>r.id===x.authorId)?.name===target));if(matches.length===1)parent=matches[0];}
  if(parent){row.replyTo=parent.id;accepted.push(row);waiting.splice(i,1);}else i++;
 }
 if(waiting.length){if(!tolerant)throw Error('回复目标无效');warnings.push('已略过 '+waiting.length+' 条无法对应到同一动态评论的回复');}
 return accepted;
}
export function deleteComment(s,id){(s.deletedCommentIds??=[]).push(id);s.comments=(s.comments||[]).filter(c=>c.id!==id);for(const t of s.turns||[])t.comments=(t.comments||[]).filter(c=>c.id!==id);}
export function identityInstruction(roles){return '作者身份必须按角色表逐项对应，不得借用另一角色的职业、店铺或署名。西拉斯是博物馆馆长；莱恩经营服装店；莱尔经营家具店。历史动态若写错职业，不继承错误设定。角色表：'+JSON.stringify(roles.map(({id,name,job})=>({id,name,job})));}
export function identityConflict(id,text,roles){const role=roles.find(r=>r.id===id);return role?.name==='西拉斯'&&/(?:我的|我开|我经营|我在|欢迎.{0,8}我|衣服.{0,12}我的|衣服.{0,12}我的店|衣服.{0,12}我的店里|衣服都在我的店|我的店.{0,15}(?:衣服|试穿)|衣服.{0,15}我的店)/.test(text)&&/服装|衣服|试穿|衣裳|制衣/.test(text);}
