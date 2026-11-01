import {packSave,unpackSave,prepareCompactStore} from './save-compaction.js';
import {planBackupImport,remapBackupMedia,sameBackupChat} from './selective-backup.js';
import {planAssetImport} from './backup-assets.js';
import {backupAssets,backupUndoPoint,writeBackupAssets} from './stickers.js';
export async function restoreSelectedBackup({file,selected,mode,origin,rows,current,settings,check,apply,migration=false}){
 check();const assets=await backupAssets(),previousUndo=await backupUndoPoint();check();
 const assetPlan=planAssetImport(assets,file,selected),remapped=Object.keys(assetPlan.map).length?{...file,data:remapBackupMedia(file.data,assetPlan.map)}:file;
 const plan=planBackupImport({current,settings,file:remapped,selected,mode,origin,rows,migration});
 const settingsBefore=Object.keys(plan.settingsPatch).map(key=>({key,exists:Object.hasOwn(settings,key),...(settings[key]!==undefined?{value:structuredClone(settings[key])}:{})}));
 const point={created:Date.now(),origin,phoneBefore:plan.phoneChanged?packSave(current):null,settingsBefore,added:assetPlan.add,selected:plan.selected};
 const expected=JSON.stringify(assets);check();await writeBackupAssets(assetPlan.add,point,{expected});
 try{check();await apply(plan.phoneChanged?prepareCompactStore(packSave(plan.next)):null,plan.settingsPatch);}
 catch(e){await writeBackupAssets([],previousUndo,{remove:assetPlan.add.map(x=>x.id)});throw e;}
 return (plan.migration?'已继承到当前聊天 ':'已恢复 ')+plan.selected.length+' 项；未选项目保留，导入前备份可撤回。';
}
export async function undoSelectedBackup({origin,current,settings={},check,apply}){
 check();const point=await backupUndoPoint();if(!point)throw Error('没有可撤回的选择导入');
 if(point.phoneBefore&&!sameBackupChat({origin:point.origin},origin))throw Error('请回到导入时对应的聊天和楼层，再撤回手机进度');
 const assets=await backupAssets(),remove=point.added.filter(a=>assets.some(x=>x.id===a.id&&JSON.stringify(x)===JSON.stringify(a))).map(x=>x.id),patch=Object.fromEntries(point.settingsBefore.map(x=>[x.key,x.exists?x.value:undefined]));check();
 // Save phone/settings first; if this fails the persistent undo and media remain untouched.
 const currentBefore=point.phoneBefore&&current?packSave(current):null,settingsBefore=Object.fromEntries(Object.keys(patch).map(k=>[k,settings[k]]));
 await apply(point.phoneBefore?prepareCompactStore(point.phoneBefore):null,patch);try{await writeBackupAssets([],null,{remove});}catch(e){await apply(currentBefore?prepareCompactStore(currentBefore):null,settingsBefore);throw e;}return '已撤回上次选择导入；后来修改过的素材保留。';
}
