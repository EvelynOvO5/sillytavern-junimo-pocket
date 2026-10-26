import {endpoint} from './core.js';
import {decodeCompletion} from './json-response.js';
export function apiMode(value){if(value===undefined||value===''||value==='openai')return 'openai';if(value==='vertex-key')return value;throw Error('API 接入方式无效，请重新选择');}
// Preserve an explicit project route. Express keys require the project-free base URL.
export function vertexEndpoint(input,model){
 endpoint(input);const u=new URL(input);if(u.protocol!=='https:'||u.port)throw Error('Google Cloud API Key 模式只支持官方 HTTPS 地址');
 if(u.hostname==='global-aiplatform.googleapis.com')u.hostname='aiplatform.googleapis.com';
 if(!/^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?aiplatform\.googleapis\.com$/.test(u.hostname))throw Error('Google Cloud API Key 模式仅支持 Google 官方 aiplatform.googleapis.com 地址；第三方中转请选择 OpenAI 兼容');
 const name=String(model||'').trim().replace(/^(?:google\/|models\/|publishers\/google\/models\/)/,'');
 if(!/^gemini-[a-zA-Z0-9._-]+$/.test(name))throw Error('请填写 Gemini 模型 ID，例如 gemini-2.5-flash，不要填写网址');
 let p=u.pathname.replace(/\/$/,'').replace(/\/chat\/completions$/,'').replace(/\/endpoints\/openapi$/,'');
 const full=p.match(/^(.*)\/publishers\/google\/models\/[^/:]+:(?:generateContent|streamGenerateContent)$/);if(full)p=full[1];
 if(!/^\/v1(?:beta1)?(?:\/projects\/[a-zA-Z0-9._-]+\/locations\/[a-z0-9-]+)?$/.test(p))throw Error('Google 地址应为 /v1，或 /v1/projects/项目ID/locations/地区/endpoints/openapi');
 if(!p.includes('/projects/')&&u.hostname!=='aiplatform.googleapis.com')throw Error('Express Key 请使用 https://aiplatform.googleapis.com/v1');
 const region=p.match(/\/locations\/([^/]+)$/)?.[1];if(region){const expected=region==='global'?'aiplatform.googleapis.com':region+'-aiplatform.googleapis.com';if(u.hostname!==expected)throw Error('Google 地址中的地区与域名不一致，请核对 locations 和接口域名');}
 u.pathname=p+'/publishers/google/models/'+name+':generateContent';return u.href;
}
function vertexParts(content){
 if(typeof content==='string')return content?[{text:content}]:[];
 if(!Array.isArray(content))throw Error('Google 请求消息格式无效');
 return content.map(p=>{if(p?.type==='text'&&typeof p.text==='string')return {text:p.text};if(p?.type==='image_url'){
 const image=p.image_url?.url?.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/);if(!image)throw Error('Google 原生图片识别请使用本地上传的图片或表情包，不支持直接传图床网址');return {inlineData:{mimeType:image[1],data:image[2]}};
 }throw Error('Google 请求包含不支持的消息内容');});
}
export function apiRequest(cfg,key,messages,maxTokens){
 const mode=apiMode(cfg.apiMode);if(mode==='openai')return {url:endpoint(cfg.url,cfg.allowHttp),headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:{model:cfg.model,messages,stream:cfg.apiStream!==false,max_tokens:maxTokens,temperature:0.5},stream:cfg.apiStream!==false,mode};
 const system=[],contents=[];for(const m of messages){const parts=vertexParts(m.content);if(!parts.length)continue;if(m.role==='system'){if(parts.some(p=>!Object.hasOwn(p,'text')))throw Error('Google 系统规则只能包含文字');system.push(...parts);}else{if(!['user','assistant'].includes(m.role))throw Error('Google 请求包含不支持的消息角色');const role=m.role==='assistant'?'model':'user',last=contents.at(-1);if(last?.role===role)last.parts.push(...parts);else contents.push({role,parts});}}
 if(!contents.length)throw Error('Google 请求没有用户消息');
 return {url:vertexEndpoint(cfg.url,cfg.model),headers:{'Content-Type':'application/json','x-goog-api-key':key},body:{...(system.length?{systemInstruction:{parts:system}}:{}),contents,generationConfig:{maxOutputTokens:maxTokens,temperature:0.5,candidateCount:1}},stream:false,mode};
}
export function decodeApiReply(raw,mode,diagnostic={}){
 if(apiMode(mode)==='openai')return decodeCompletion(raw,diagnostic);
 let data;try{data=JSON.parse(raw);}catch{throw Error('Google 返回的 JSON 不完整，未应用本次内容');}
 if(data?.error)throw Error('Google 返回错误，未应用本次内容，请检查渠道或额度');
 const candidates=Array.isArray(data?.candidates)?data.candidates:[],c=candidates.find(c=>c&&(c.index??0)===0),parts=Array.isArray(c?.content?.parts)?c.content.parts:[],finish=c?.finishReason,text=parts.filter(p=>p&&!p?.thought&&typeof p.text==='string').map(p=>p.text).join(''),reasoningChars=parts.filter(p=>p.thought&&typeof p.text==='string').reduce((n,p)=>n+p.text.length,0),usage=data?.usageMetadata;
 Object.assign(diagnostic,{format:'google-json',choices:candidates.length,finish,contentChars:text.length,reasoningChars,...(usage?{usage:{promptTokens:usage.promptTokenCount,outputTokens:usage.candidatesTokenCount,reasoningTokens:usage.thoughtsTokenCount}}:{})});
 if(finish==='MAX_TOKENS')throw Error('Google 输出达到 token 上限，未应用不完整回复；请提高输出上限后重试');
 if(data?.promptFeedback?.blockReason||finish&&finish!=='STOP')throw Error('Google 未完成本次生成（'+(data?.promptFeedback?.blockReason||finish)+'），未应用回复');
 if(!finish)throw Error('Google 回复缺少完成标记，未应用不完整内容');
 if(!text.trim())throw Error(reasoningChars||usage?.thoughtsTokenCount?'Google 只返回思考，没有最终回复，请提高输出上限':'Google 未返回有效文字，未应用本次内容');return text;
}
