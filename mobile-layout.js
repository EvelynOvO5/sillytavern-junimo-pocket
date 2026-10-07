// Keep the established phone width when a software keyboard reduces viewport height.
export function phoneLayout({width,height,visibleHeight=height,focused=false},previous){
 const sameWidth=previous&&Math.abs(width-previous.baseWidth)<30;
 const baseHeight=sameWidth?previous.baseHeight:height;
 const keyboard=!!sameWidth&&(focused||previous.keyboard)&&baseHeight-visibleHeight>Math.min(120,baseHeight*.18);
 const scale=keyboard?previous.scale:Math.max(.2,Math.min(1,(height-24)/680,(width-24)/350));
 const screenHeight=keyboard?Math.max(260,Math.min(640,(visibleHeight-24)/scale-40)):640;
 return {scale,screenHeight,phoneHeight:(screenHeight+40)*scale,availableHeight:keyboard?visibleHeight:height,baseWidth:width,baseHeight:keyboard?baseHeight:height,keyboard};
}
