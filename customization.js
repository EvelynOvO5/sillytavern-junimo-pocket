export function customGroup(id,name,members,roles,existing=[]){
 if(typeof id!=='string'||!id.startsWith('group-custom-')||existing.some(g=>g.id===id))throw Error('群聊编号无效');
 if(!Array.isArray(members)||members.some(id=>!roles.some(r=>r.id===id)))throw Error('只能邀请已有角色');const selected=[...new Set(members)];if(selected.length<2)throw Error('至少选择两位角色');
 if(typeof name!=='string'||name.trim().length>32)throw Error('群名称最多32字');return {id,name:name.trim()||selected.map(id=>roles.find(r=>r.id===id).name).join('、').slice(0,28)+'的群聊',job:'自建群聊',members:selected};
}
export function saveCssPreset(presets,{id,name,css}){if(typeof id!=='string'||!id||typeof name!=='string'||!name.trim()||name.trim().length>40)throw Error('请填写1到40字的预设名称');if(typeof css!=='string'||!css.trim()||css.length>80000)throw Error('CSS请填写1到80000字');if(/@import\b|<\/?(?:script|style)\b/i.test(css))throw Error('这里只填写CSS，不能包含HTML标签或@import');const next=(presets||[]).filter(p=>p.id!==id);next.push({id,name:name.trim(),css});return next;}
export function scopedChatCss(css,document,kind='thread'){
 if(!css.trim())return '';if(/@import\b|<\/?(?:script|style)\b/i.test(css))throw Error('请使用纯CSS，不包含HTML或@import');
 const style=document.createElement('style');style.media='not all';style.textContent=css;document.head.append(style);
 try{const global=kind==='global',scope=global?':is(#chatApp,.jp-chat-surface)':'#chatApp.chat-room-open';const selectors=text=>{let parts=[],start=0,depth=0,quote='',escape=false;for(let i=0;i<text.length;i++){const c=text[i];if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(quote){if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===','&&!depth){parts.push(text.slice(start,i));start=i+1;}}parts.push(text.slice(start));return parts.map(s=>{s=s.trim().replace(/^(?:html|body|:root|:host)(?=\s|\.|#|$)/,scope);if(s.startsWith(scope))return s;if(/^#chatApp(?=[\s.#[:]|$)/.test(s))return global?s:s.replace(/^#chatApp/,scope);if(global&&s.startsWith('.jp-chat-surface'))return s;const descendant=scope+' '+s;return global&&/^[.[:]/.test(s)?descendant+','+scope+s:descendant;}).join(',');};
 const render=rules=>Array.from(rules).map(rule=>{if(rule.selectorText){const declarations=Array.from(rule.style).map(key=>key+':'+rule.style.getPropertyValue(key)+' !important;').join('');return selectors(rule.selectorText)+'{'+declarations+'}';}if(rule.type===7||rule.type===8)return rule.cssText;if(rule.cssRules)return rule.cssText.slice(0,rule.cssText.indexOf('{')+1)+render(rule.cssRules)+'}';throw Error('暂不支持这类CSS规则，请使用选择器、媒体查询或关键帧');}).join('\n');
 if(!style.sheet?.cssRules.length)throw Error('没有可应用的CSS规则，请检查格式');return render(style.sheet.cssRules);
 }finally{style.remove();}
}

export function effectiveCssPresetId(appearance={},thread={}){return Object.prototype.hasOwnProperty.call(thread,'cssPresetId')?thread.cssPresetId:appearance.defaultCssPresetId||null;}
