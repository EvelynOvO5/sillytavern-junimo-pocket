const KEY='junimo_pocket_device_ui_v1';
const point=p=>p&&Number.isFinite(p.left)&&Number.isFinite(p.top)?{left:p.left,top:p.top}:null;
export function defaultBadgePosition(width){return {left:Math.max(6,width-76),top:70};}
export function clampBadgePosition(p,width,height){return {left:Math.max(6,Math.min(p.left,width-64)),top:Math.max(6,Math.min(p.top,height-64))};}
export function createDevicePreferences(storage,settings,save=()=>{}){
 let local={};try{local=JSON.parse(storage.getItem(KEY)||'{}')||{};}catch{}
 let position=point(local.badgePosition)||point({left:settings.left,top:settings.top}),night=typeof local.night==='boolean'?local.night:!!settings.nightMode;
 const persist=()=>{try{storage.setItem(KEY,JSON.stringify({badgePosition:position,night}));}catch{}if(position)Object.assign(settings,position);settings.nightMode=night;save();};
 return {position:width=>position||defaultBadgePosition(width),savePosition(p){const valid=point(p);if(!valid)throw Error('图标位置无效');position=valid;persist();},reset(width){position=defaultBadgePosition(width);persist();return {...position};},night:()=>night,setNight(value){night=!!value;persist();return night;}};
}
