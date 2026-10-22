// Diagnostics are disposable. Delivery receipts and game progress are never pruned here.
export const ERROR_HISTORY_LIMIT=20;
export const diagnosticText=value=>String(value??'').slice(0,1200);
export function pruneTurnErrors(s,limit=ERROR_HISTORY_LIMIT){
 const turns=s.turns||[],retained=new Set();let remaining=limit,changed=false;
 for(let i=turns.length-1;i>=0;i--){const turn=turns[i];if(!turn||!Object.hasOwn(turn,'phoneError'))continue;if(remaining-->0){const text=diagnosticText(turn.phoneError);if(text!==turn.phoneError){turn.phoneError=text;changed=true;}if(turn.signature)retained.add(turn.signature);}else{delete turn.phoneError;changed=true;}}
 for(const owner of [s.backup,s.recordBackup,s.structureBackup,s.legacyBackup,s.demoBackup,s.turnGapBackup])for(const turn of owner?.turns||[]){if(!turn||!Object.hasOwn(turn,'phoneError'))continue;if(!turn.signature||!retained.has(turn.signature)){delete turn.phoneError;changed=true;}else{const text=diagnosticText(turn.phoneError);if(text!==turn.phoneError){turn.phoneError=text;changed=true;}}}
 return changed;
}
