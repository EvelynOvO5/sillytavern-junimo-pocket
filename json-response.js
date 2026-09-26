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
