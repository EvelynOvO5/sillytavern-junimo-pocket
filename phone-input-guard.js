import {deepActiveElement} from './mobile-layout.js';
// Keep phone interaction inside its shadow host without cancelling native editing or scrolling.
export function installPhoneInputGuard(host,{document:owner=host.ownerDocument,isOpen=()=>true}={}){
 const cleanups=[];const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);cleanups.push(()=>target.removeEventListener(type,handler,options));};
 const stop=e=>e.stopPropagation();
 const previousIgnore=host.getAttribute('data-swipe-ignore');host.setAttribute('data-swipe-ignore','true');
 for(const type of ['keydown','keyup','keypress'])listen(host,type,stop,false);
 for(const type of ['touchstart','touchmove','touchend','touchcancel'])listen(host,type,stop,{passive:true});
 const inside=e=>e.composedPath?.().includes(host)||host.contains(e.target);
 const editing=()=>{const focused=deepActiveElement(host);return focused&&focused!==host&&(focused.matches?.('input,textarea,select')||focused.isContentEditable);};
 const guardSwipe=e=>{if(inside(e)||isOpen()&&editing())e.stopPropagation();};
 for(const type of ['swiped','swiped-left','swiped-right','swipeleft','swiperight'])listen(owner,type,guardSwipe,true);
 return ()=>{for(const cleanup of cleanups)cleanup();if(previousIgnore===null)host.removeAttribute('data-swipe-ignore');else host.setAttribute('data-swipe-ignore',previousIgnore);};
}
