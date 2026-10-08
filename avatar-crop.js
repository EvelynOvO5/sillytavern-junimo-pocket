const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function avatarCropRect(width,height,{zoom=1,x=.5,y=.5}={}){
 if(!(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0))throw Error('图片尺寸无效');
 zoom=clamp(Number.isFinite(zoom)?zoom:1,1,4);const size=Math.min(width,height)/zoom;
 return {x:clamp((Number.isFinite(x)?x:.5)*width-size/2,0,width-size),y:clamp((Number.isFinite(y)?y:.5)*height-size/2,0,height-size),size,zoom};
}
export function moveAvatarCrop(width,height,state,dx,dy,viewSize){
 if(!(viewSize>0))return state;
 const rect=avatarCropRect(width,height,state),x=clamp(rect.x-dx*rect.size/viewSize,0,width-rect.size),y=clamp(rect.y-dy*rect.size/viewSize,0,height-rect.size);
 return {zoom:rect.zoom,x:(x+rect.size/2)/width,y:(y+rect.size/2)/height};
}
export async function openAvatarCrop({root,source,owner,signal}){
 if(signal?.aborted)return null;
 if(!/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(source))throw Error('请从本地选择头像图片');
 const screen=root.querySelector('.screen'),doc=screen.ownerDocument,image=doc.createElement('img');image.src=source;
 await image.decode();if(signal?.aborted||!owner.isConnected)return null;
 return new Promise(resolve=>{
 const dialog=doc.createElement('div');dialog.className='jp-avatar-crop';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','裁剪头像');
 dialog.innerHTML='<style>.jp-avatar-crop{position:absolute;inset:0;z-index:2200;background:#332b3b99;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}.jp-avatar-crop .jp-crop-card{width:100%;max-height:100%;overflow:auto;box-sizing:border-box;padding:20px;border-radius:24px;background:linear-gradient(145deg,#fff6f9,#f4f7ef);color:#705969;box-shadow:0 12px 40px #44334933}.jp-avatar-crop h3{margin:0;font-size:17px}.jp-avatar-crop p{font-size:11px;line-height:1.6;margin:8px 0 14px;color:#9c8493}.jp-crop-stage{position:relative;width:100%;aspect-ratio:1;border-radius:16px;overflow:hidden;background:repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0/18px 18px}.jp-crop-stage canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.jp-crop-stage canvas:active{cursor:grabbing}.jp-crop-grid{position:absolute;inset:0;pointer-events:none;border:1px solid #fff9;border-radius:16px;background:linear-gradient(to right,transparent 33%,#ffffff66 33%,#ffffff66 33.4%,transparent 33.4%,transparent 66.6%,#ffffff66 66.6%,#ffffff66 67%,transparent 67%),linear-gradient(to bottom,transparent 33%,#ffffff66 33%,#ffffff66 33.4%,transparent 33.4%,transparent 66.6%,#ffffff66 66.6%,#ffffff66 67%,transparent 67%)}.jp-crop-controls{display:flex;align-items:center;gap:12px;margin:15px 0}.jp-crop-controls label{display:block;flex:1;min-width:0;font-size:11px}.jp-avatar-crop input[type=range]{display:block;width:100%;padding:0;margin:8px 0 0;accent-color:#c997b2;touch-action:pan-y}.jp-crop-preview{width:48px;height:48px;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px #77596822;flex-shrink:0}.jp-crop-buttons{display:flex;gap:7px}.jp-avatar-crop button{font:12px Microsoft YaHei,sans-serif;min-width:0;flex:1;border:0;border-radius:12px;padding:11px 5px;background:#eee4e9;color:#876a7c;cursor:pointer}.jp-avatar-crop [data-confirm]{background:#bb8fa6;color:#fff}.jp-crop-error{color:#b54d70!important;margin-bottom:0!important}</style><section class="jp-crop-card"><h3>让头像，刚刚好。</h3><p>拖动图片调整位置，滑动下方调整大小。<br>裁剪后保存为静态头像。</p><div class="jp-crop-stage"><canvas width="512" height="512" tabindex="0" aria-label="头像裁剪区域，可拖动或用方向键移动"></canvas><div class="jp-crop-grid"></div></div><div class="jp-crop-controls"><label>缩放 <span data-zoom-label>1.0×</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="头像缩放"></label><canvas class="jp-crop-preview" width="96" height="96" aria-label="圆形头像预览"></canvas></div><div class="jp-crop-buttons"><button type="button" data-cancel>取消</button><button type="button" data-reset>重置</button><button type="button" data-confirm>使用头像</button></div><p class="jp-crop-error" role="status"></p></section>';
 const canvas=dialog.querySelector('.jp-crop-stage canvas'),preview=dialog.querySelector('.jp-crop-preview'),slider=dialog.querySelector('input'),label=dialog.querySelector('[data-zoom-label]'),w=image.naturalWidth,h=image.naturalHeight;let state={zoom:1,x:.5,y:.5},drag=null,settled=false;
 const observer=new MutationObserver(()=>{if(!owner.isConnected||!dialog.isConnected)finish(null);});
 function finish(value){if(settled)return;settled=true;observer.disconnect();signal?.removeEventListener('abort',cancel);dialog.remove();if(owner.isConnected)owner.querySelector('button')?.focus({preventScroll:true});resolve(value);}
 const cancel=()=>finish(null);
 function draw(){const r=avatarCropRect(w,h,state);for(const c of [canvas,preview]){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(image,r.x,r.y,r.size,r.size,0,0,c.width,c.height);}slider.value=state.zoom;label.textContent=state.zoom.toFixed(1)+'×';}
 function move(dx,dy){state=moveAvatarCrop(w,h,state,dx,dy,canvas.getBoundingClientRect().width);draw();}
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;move(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{drag=null;});
 canvas.addEventListener('keydown',e=>{const steps={ArrowLeft:[8,0],ArrowRight:[-8,0],ArrowUp:[0,8],ArrowDown:[0,-8]};if(steps[e.key]){e.preventDefault();move(...steps[e.key]);}});
 slider.addEventListener('input',()=>{state.zoom=Number(slider.value);const r=avatarCropRect(w,h,state);state.x=(r.x+r.size/2)/w;state.y=(r.y+r.size/2)/h;draw();});
 dialog.querySelector('[data-reset]').onclick=()=>{state={zoom:1,x:.5,y:.5};draw();};dialog.querySelector('[data-cancel]').onclick=cancel;
 dialog.querySelector('[data-confirm]').onclick=()=>{try{finish(canvas.toDataURL('image/png'));}catch(e){dialog.querySelector('.jp-crop-error').textContent='头像保存失败，请重新选择图片';}};
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();cancel();}});
 screen.append(dialog);observer.observe(screen,{childList:true,subtree:true});signal?.addEventListener('abort',cancel,{once:true});draw();dialog.querySelector('[data-confirm]').focus({preventScroll:true});
 });
}
