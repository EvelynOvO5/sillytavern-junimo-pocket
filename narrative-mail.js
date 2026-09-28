// Local extraction: a received letter is an event, not a random phone notification.
export const mailSyncInstruction='若正文明确写用户已经收到一封新信，在正文末尾另附【手机来信】块：发信人：真实姓名（未知写未知，匿名写匿名）；标题：信件标题；正文：原信全文；最后写【来信结束】。各字段独占一行，正文可多行。仅同步已经送达的信，不写计划、假设、旧信回忆或重复来信，不编造正文未出现的信件。';
function makeLetter(sender,subject,body,roles,key,excerpt=false){const r=roles.find(r=>r.name===sender||r.id===sender);return {id:'story-mail-'+key,senderId:r?.id||'stranger',senderName:r?undefined:sender||'未知寄信人',anonymous:sender==='匿名',subject:subject||'正文中收到的信',body,kind:'letter',category:'regular',read:false,created:Date.now(),source:'narrative',excerpt};}
export function narrativeLetters(text,roles,signature,userName='用户'){const out=[];let index=0;for(const m of String(text).matchAll(/【手机来信】\s*发信人[：:]\s*([^\n]+)\s*\n标题[：:]\s*([^\n]+)\s*\n正文[：:]\s*([\s\S]*?)【来信结束】/g)){const body=m[3].trim();if(body&&body.length<=16000)out.push(makeLetter(m[1].trim(),m[2].trim().slice(0,80),body,roles,signature+'-'+index++));}if(out.length)return out;
 const prose=String(text).split(/【手机状态】|<junimo-state>|【手机来信】/)[0];
 // Older prose often prints several signed letters after opening a mailbox.
 // Only collect quoted letters near a concrete receipt/opening, never quoted plans.
 for(const q of prose.matchAll(/“([^”]{1,8000})”/g)){
   const before=prose.slice(Math.max(0,q.index-1300),q.index),near=before.slice(-240),signed=q[1].match(/(?:\n\s*)?[—－-]{2,}\s*([^\n]{1,45})\s*$/);
   if(!signed||!/(?:信纸|信件|封信|一封|来信|纸张|信中|信上)/.test(near))continue;
   const events=before.split(/[。！？\n]/).filter(x=>/(?:邮箱|信箱|信件|封信|几封信)/.test(x));
   const delivered=events.some(x=>/(?:拉开|打开|收到|接过|取出|拿了出来|拿出来|取了出来|拆开)/.test(x)&&!/(?:如果|假如|也许|可能|打算|准备|将会|明天|尚未|没有|并未)/.test(x));
   if(!delivered)continue;
   const sender=signed[1].trim().replace(/\s*(?:敬上|谨上|敬启|敬呈)\s*$/,'').trim();
   out.push(makeLetter(sender,'来自'+sender+'的信',q[1].trim(),roles,signature+'-quoted-'+index++));
 }
 if(out.length)return out.slice(0,8);
 const paragraphs=prose.split(/\n\s*\n|\n/).map(x=>x.trim()).filter(Boolean);
 for(let i=0;i<paragraphs.length;i++){const p=paragraphs[i].replaceAll(userName||'用户','用户');if(!/(?:你|您|用户|{{user}}).{0,35}(?:收到|接过|取出|拆开|打开).{0,25}(?:信件|来信|信封|一封信)|(?:信箱|邮箱).{0,30}(?:多了|躺着|放着|发现|收到).{0,25}(?:信|邮件)/.test(p)||/(?:如果|假如|也许|可能|打算|准备|明天|将会|尚未|没有|并未|没能).{0,35}(?:收到|接过|拆开|打开|信箱)/.test(p))continue;
 const excerpt=paragraphs.slice(Math.max(0,i-1),Math.min(paragraphs.length,i+3)).join('\n').slice(0,2400);const sender=roles.find(r=>new RegExp(r.name+'.{0,10}(?:寄|写|送|来信)|(?:来自|署名|落款)[：:、\\s]*'+r.name).test(excerpt))?.name||'未知寄信人';
 out.push(makeLetter(sender,'正文中收到的信',excerpt+'\n\n（正文收信摘录；未提供的完整信文不会自动补写。）',roles,signature+'-'+index++,true));i+=2;
 }return out.slice(0,8);
}
