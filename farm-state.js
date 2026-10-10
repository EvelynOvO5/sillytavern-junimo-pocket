export const plotView=p=>({crop:p?.crop||'',days:p?.days??null,wet:!!p?.wet,fertilizer:p?.fertilizer||''});
export function advancedFarmDay(before,after){const tuple=s=>[s.calendar?.year||0,['春季','夏季','秋季','冬季'].indexOf(s.calendar?.season),s.calendar?.day||0],a=tuple(before),b=tuple(after);return b[0]>a[0]||b[0]===a[0]&&(b[1]>a[1]||b[1]===a[1]&&b[2]>a[2]);}
