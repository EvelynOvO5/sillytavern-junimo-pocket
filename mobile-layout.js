// Resolve nested shadow roots: the outer active element is the phone host, not its input.
export function deepActiveElement(host){let element=host;while(element?.shadowRoot?.activeElement)element=element.shadowRoot.activeElement;return element;}
export function phoneLayout({width,height,visibleHeight=height,focused=false},previous){
 const sameWidth=previous&&Math.abs(width-previous.baseWidth)<30,baseHeight=sameWidth?previous.baseHeight:height;
 const keyboard=!!sameWidth&&(focused||previous.keyboard)&&baseHeight-visibleHeight>Math.min(120,baseHeight*.18);
 const scale=keyboard?previous.scale:Math.max(.2,Math.min(1,(height-24)/680,(width-24)/350));
 return {scale,screenHeight:640,phoneHeight:680*scale,availableHeight:keyboard?visibleHeight:height,baseWidth:width,baseHeight:keyboard?baseHeight:height,keyboard};
}
export function phoneTop(layout,restingTop,{offsetTop=0,focusedBottom=layout.phoneHeight}={}){return layout.keyboard?Math.min(restingTop,offsetTop+layout.availableHeight-focusedBottom-12):Math.max(6,Math.min(restingTop,layout.availableHeight-layout.phoneHeight-6));}
