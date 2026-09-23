import {parseBubbles} from './protocol.js';
export function chatInstruction(role,roles){
 const members=role.members?.map(id=>roles.find(r=>r.id===id)).filter(Boolean);
 if(members)return `这是手机群聊“${role.name}”，群成员只有用户与${members.map(r=>r.name+'（'+r.id+'）').join('、')}。你负责成员各自的发言，不得扮演用户，不要把不同成员混为一个人，不必所有人每次都回应。仅返回 JSON：{"messages":[{"roleId":"成员ID","text":"一个简短气泡"}]}，1到8个气泡，每个气泡标明真实说话人的ID。`;
 return `这是用户与${role.name}（ID ${role.id}）的一对一手机私聊。你只能扮演${role.name}，绝不替其他角色发言，尤其莱恩与莱尔是两个独立的人：莱恩是服装店角色，莱尔是家具店角色，不能轮流说话、串台或以兄弟名字作前缀。可以在自己的话中提及他人，但不能输出他人的台词。仅返回 JSON：{"bubbles":["一个短气泡","补充一句"]}，1到6条，不写姓名前缀。`;
}
export function parseChatReply(raw,role,roles){
 if(role.members){const result=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));if(!Array.isArray(result.messages)||!result.messages.length||result.messages.length>8)throw Error('群聊消息格式无效');return result.messages.map(m=>{if(!role.members.includes(m.roleId)||typeof m.text!=='string'||!m.text.trim()||m.text.length>2000)throw Error('群聊出现非成员或无效消息');return {speakerId:m.roleId,text:m.text.trim()};});}
 return parseBubbles(raw).map(text=>{for(const other of roles.filter(r=>r.id!==role.id)){if(text.includes('['+other.name+']')||text.includes('【'+other.name+'】')||new RegExp('(^|\\n)'+other.name+'[：:]').test(text))throw Error('回复混入其他角色，已拦截；请重试');}return {speakerId:role.id,text:text.replace(new RegExp('^(?:\\['+role.name+'\\]|【'+role.name+'】|'+role.name+')[：:]?\\s*'),'')};});
}
