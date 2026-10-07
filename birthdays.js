// Recurring birthdays are calendar facts, independent of generated state events.
export const characterBirthdays=[
 {roleId:'01',name:'阿德里安',english:'Adrian',season:'春季',day:6},
 {roleId:'13',name:'哈兰',english:'Harlan',season:'春季',day:17},
 {roleId:'04',name:'艾利安',english:'Elian',season:'春季',day:22},
 {roleId:'09',name:'阿波罗',english:'Apollo',season:'夏季',day:3},
 {roleId:'05',name:'伊诺克',english:'Enoch',season:'夏季',day:16},
 {roleId:'03',name:'雷克斯',english:'Rex',season:'夏季',day:23},
 {roleId:'08',name:'奥兹',english:'Oz',season:'秋季',day:5},
 {roleId:'07',name:'维克托',english:'Victor',season:'秋季',day:12},
 {roleId:'10',name:'莱尔',english:'Lyle',season:'秋季',day:22},
 {roleId:'11',name:'莱恩',english:'Lane',season:'秋季',day:22},
 {roleId:'02',name:'塞勒斯',english:'Cyrus',season:'冬季',day:4},
 {roleId:'12',name:'奈里斯',english:'Neris',season:'冬季',day:12},
 {roleId:'06',name:'西拉斯',english:'Silas',season:'冬季',day:21}
];
const seasons=['春季','夏季','秋季','冬季'];
const seasonName=s=>{const value=String(s||'');return /^[春夏秋冬]$/.test(value)?value+'季':value;};
const ordinal=e=>{const season=seasons.indexOf(seasonName(e.season));return season<0||!Number.isInteger(e.day)||e.day<1||e.day>28?null:season*28+e.day-1;};
export function birthdaysToday(calendar={}){const day=ordinal(calendar);return day===null?[]:characterBirthdays.filter(b=>ordinal(b)===day);}
export function calendarWithBirthdays(events=[],calendar={},roles=[]){
 const matchesBirthday=e=>/生日/.test(e.name||'')&&characterBirthdays.some(b=>{
  const canonical=roles.find(r=>r.id===b.roleId)?.name;
  return e.roleId===b.roleId||e.person===b.roleId||[b.name,b.english,canonical,b.roleId==='07'?'维克多':null].filter(Boolean).some(n=>e.person===n||String(e.name||'').includes(n));
 });
 const rows=[...events.filter(e=>!matchesBirthday(e)).map(e=>({...e})),...characterBirthdays.map(b=>({...b,id:'birthday-'+b.roleId,type:'birthday',person:roles.find(r=>r.id===b.roleId)?.name||b.name,name:b.name+'的生日',detail:b.english+' · 每年'+b.season+b.day+'日'}))];
 const now=ordinal(calendar);for(const e of rows)e.today=now!==null&&ordinal({...e,season:e.season||calendar.season})===now;
 return rows.sort((a,b)=>{const order=e=>{const value=ordinal({...e,season:e.season||calendar.season});return value===null?999:now===null?value:(value-now+112)%112;};return order(a)-order(b);});
}
export function birthdayMemory(calendar={}){return '\n【角色固定生日】\n'+JSON.stringify({birthdays:characterBirthdays,today:birthdaysToday(calendar).map(b=>b.name),rule:'这些生日每个游戏年重复；以当前故事季节与日历日期为准，不能随正文改动或依据电脑日期推算。生日不自动增加好感或送出礼物。维克托与角色表的维克多是同一人。'})+'\n';}
