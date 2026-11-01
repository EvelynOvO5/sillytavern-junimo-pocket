import {packSave,unpackSave,withCheckpointFields} from './save-compaction.js';
import {world} from './core.js';
const key=q=>String(q.name||q.subject||'').normalize('NFKC').trim();
const identity=r=>r?.id?'id:'+r.id:JSON.stringify(r);
const emptyState=state=>({...state,quests:[],notes:'',calendarEvents:[],farmProjects:[],locations:{}});
// Financial revisions stay intact. Only inherited narrative descriptions are removed.
export function resetTheatreStory(s,main,{fresh=false,boundary=main.turns?.length||0,force=false}={}){
 if(!fresh&&(!s.theatre?.active||!force&&s.theatreStoryVersion===2))return false;
 const mainState=world(main),baseline=emptyState(mainState),revision=main.socialEvents?.at(-1)?.revision||main.baseSocialRevision||0;
 const taskNames=new Set([...(mainState.quests||[]),...(main.mailQuests||[])].map(key));
 const inherited=new Map(['mailQuests','taskCompletionReceipts','offerings','offeringRewards','skillEventLog'].map(k=>[k,new Set((main[k]||[]).map(identity))]));
 const events=new Set((main.socialEvents||[]).map(e=>e.id));
 const cleanRoot=source=>{const out={};for(const [k,ids]of inherited)out[k]=fresh?[]:(source[k]||[]).filter(r=>!ids.has(identity(r)));out.socialEvents=(source.socialEvents||[]).map(e=>events.has(e.id)?{...e,description:''}:e);out.theatreStoryVersion=2;out.theatreInheritedRevision=revision;return out;};
 const cleanState=state=>{if(!state)return state;const next={...state,quests:(state.quests||[]).filter(q=>!taskNames.has(key(q)))};if(typeof next.notes==='string'&&typeof mainState.notes==='string'&&mainState.notes)next.notes=next.notes.split(mainState.notes).join('').trim();for(const k of ['calendarEvents','farmProjects']){const ids=new Set((mainState[k]||[]).map(r=>r.id||r.name||identity(r)));next[k]=(next[k]||[]).filter(r=>!ids.has(r.id||r.name||identity(r)));}next.locations=Object.fromEntries(Object.entries(next.locations||{}).filter(([id,v])=>JSON.stringify(v)!==JSON.stringify(mainState.locations?.[id])));return next;};
 const baselinePool=packSave(baseline),copyBaseline=()=>unpackSave(baselinePool,{trusted:true});s.base=copyBaseline();s.baseSocialRevision=revision;Object.assign(s,cleanRoot(s));s.questHistoryVersion=1;
 for(let i=0;i<(s.turns||[]).length;i++){const t=s.turns[i];if(!t)continue;if(i<boundary){t.state=copyBaseline();t.socialRevision=revision;t.hasState=false;for(const k of ['actionDraft','actionBase','farmCorrection','candidateBase'])delete t[k];}else{t.state=cleanState(t.state);t.actionBase=cleanState(t.actionBase);}if(t.before)t.before=withCheckpointFields(t.before,cleanRoot(t.before));}
 for(const k of ['pendingNarrativeBase','pendingNarrativeDraft','pendingNarrativeFloor','pendingNarrativeRevision','questRecoveryBackup'])delete s[k];
 if(fresh){s.shop={stores:{},cart:[],orders:[]};s.draft=null;}else if(s.shop){const ids=new Set((main.shop?.orders||[]).map(o=>o.id));s.shop={...s.shop,orders:(s.shop.orders||[]).filter(o=>!ids.has(o.id))};}
 return true;
}
export function ensureTheatreStory(s,{chat,force=false}={}){if(!s?.theatre?.active||!force&&s.theatreStoryVersion===2)return false;const main=unpackSave(s.theatre.active.main),at=chat?.findIndex(m=>m.extra?.junimoTheatre?.id===s.theatre.active.id);return resetTheatreStory(s,main,{force,boundary:at>=0?at:main.turns?.length||0});}
// Strip old assistant summaries from prompt copies; the current IF state is injected separately.
export function theatreNarrative(raw){return String(raw||'').replace(/【手机状态】[\s\S]*?(?:【状态结束】|$)/g,'').replace(/<junimo-state>[\s\S]*?(?:<\/junimo-state>|$)/gi,'').trim();}
