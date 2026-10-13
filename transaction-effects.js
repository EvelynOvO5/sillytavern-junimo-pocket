export function transactionEffectsFor(store,turn){
 const result=structuredClone(store.transactionResolutions||{});
 for(const [id,local] of Object.entries(turn?.transactionEffects||{})){const old=result[id]||{};result[id]={...old,...local,items:[...(old.items||[]),...(local.items||[])].filter((x,i,a)=>a.findIndex(y=>y.name===x.name&&y.count===x.count)===i)};}
 return result;
}
