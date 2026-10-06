// Repair only unambiguous transport/formatting mistakes, never evaluate generated code.
export function parseResponseJSON(raw){
 const text=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{return JSON.parse(text);}catch{}
 let result='',quoted=false,escaped=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c.charCodeAt(0)<32){if(escaped){result+=JSON.stringify(c).slice(2,-1);escaped=false;}else result+=JSON.stringify(c).slice(1,-1);continue;}result+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
  else {if(c==='"')quoted=true;if(c===','&&/^\s*[}\]]/.test(text.slice(i+1)))continue;result+=c;}
 }
 try{return JSON.parse(result);}catch{throw Error('API 回复格式不完整，未应用这次内容；请重试');}
}

// Transport decoding is separate from game JSON parsing. Never use reasoning as a reply.
export function decodeCompletion(raw,diagnostic={}){
 let data,frames=[];
 const input=String(raw||'').replace(/^\uFEFF/,'').trim();
 try{data=JSON.parse(input);frames=[data];diagnostic.format='json';}
 catch{
  if(!/^data:|^event:|^:/m.test(input))throw Error('API 返回的不是有效 JSON 或流式回复，请检查服务商渠道');
  diagnostic.format='sse';
  for(const event of input.split(/\r?\n\r?\n/)){
   const value=event.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n').trim();
   if(!value)continue;if(value==='[DONE]'){diagnostic.done=true;continue;}
   try{frames.push(JSON.parse(value));}catch{throw Error('API 流式数据不完整，未应用本次内容，请手动重试');}
  }
 }
 let text='',finish=null,choices=0,reasoningChars=0,refusal=false,tools=false;
 const contentText=c=>typeof c==='string'?c:Array.isArray(c)?c.map(p=>p?.type==='text'||p?.type==='output_text'?typeof p.text==='string'?p.text:p.text?.value||'':'').join(''):'';
 for(const frame of frames){
  if(frame?.error)throw Error('API 服务商返回错误（HTTP 成功但请求未成功），请检查服务商渠道或额度');
  if(frame?.usage)diagnostic.usage={promptTokens:frame.usage.prompt_tokens,outputTokens:frame.usage.completion_tokens,reasoningTokens:frame.usage.completion_tokens_details?.reasoning_tokens};
  if(!Array.isArray(frame?.choices))continue;
  choices+=frame.choices.length;
  const c=frame.choices.find(c=>(c.index??0)===0);if(!c)continue;
  const m=c.delta||c.message||{};
  const part=contentText(m.content)||contentText(c.text);
  if(c.delta)text+=part;else if(part)text=part;
  reasoningChars+=contentText(m.reasoning_content||m.reasoning).length;
  refusal ||= !!m.refusal;tools ||= !!m.tool_calls?.length;
  if(c.finish_reason)finish=c.finish_reason;
 }
 Object.assign(diagnostic,{frames:frames.length,choices,finish,contentChars:text.length,reasoningChars});
 if(finish==='length'||finish==='max_tokens')throw Error('API 输出达到上限'+(reasoningChars?'，模型思考占用了输出预算':'')+'，请提高单次输出 token 上限后手动重试');
 if(finish==='content_filter'||finish==='SAFETY'||refusal)throw Error('服务商拒绝生成本次内容，未应用回复；请查看服务商提示');
 if(diagnostic.format==='sse'&&!diagnostic.done&&!finish)throw Error('API 流式连接提前结束，未应用不完整回复，请手动重试');
 if(!text.trim()){
  if(reasoningChars||diagnostic.usage?.reasoningTokens)throw Error('API 只返回思考、没有最终回复；请提高输出上限或使用适合短回复的模型');
  if(!choices)throw Error('API 返回空候选（choices 为空），未生成任何回复；可切换流式接收后重试，或检查服务商渠道');
  if(tools)throw Error('API 返回了工具调用，没有手机所需的文字回复');
  throw Error('API 返回空正文（输出 '+(diagnostic.usage?.outputTokens??'未知')+' token）；请查看请求诊断或切换服务商渠道');
 }
 if(/The prompt could not be submitted[\s\S]*Prohibited Use policy/i.test(text)){diagnostic.providerRejected=true;throw Error('服务商拒绝了本次上下文（内容规则限制），不是连接失败；简短连接测试成功不代表实际剧情请求被接受。');}
 return text;
}
