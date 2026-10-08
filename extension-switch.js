// The master switch is separate from narrative synchronization preferences.
export function createPluginSwitch({settings,save,stop,start}){
 const active=()=>settings().pluginEnabled!==false;
 return {active,set(value){const next=!!value;if(next===active())return;settings().pluginEnabled=next;if(next)start();else stop();save();}};
}
export function mountExtensionSwitch({document,active,set,openSettings}){
 const container=document.querySelector('#extensions_settings')||document.querySelector('#extensions_settings2');
 if(!container||document.getElementById('junimo-pocket-settings'))return;
 const section=document.createElement('div');section.id='junimo-pocket-settings';
 section.innerHTML='<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>月亮谷手机 · Junimo Pocket</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"><label class="checkbox_label"><input type="checkbox" data-jp-enable><span>启用月亮谷手机</span></label><small data-jp-status></small><p><button type="button" class="menu_button" data-jp-settings>打开手机设置</button></p><small>关闭后停止手机同步、生成和正文注入；保留存档与设置。开关即时生效，无需刷新。</small></div></div>';
 const input=section.querySelector('[data-jp-enable]'),status=section.querySelector('[data-jp-status]'),button=section.querySelector('[data-jp-settings]');
 const refresh=()=>{input.checked=active();status.textContent=active()?'手机已开启':'手机已关闭';button.disabled=!active();};
 input.addEventListener('change',()=>{set(input.checked);refresh();});button.addEventListener('click',()=>{if(active())openSettings();});container.append(section);refresh();return section;
}
