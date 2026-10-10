const homeControls=uiDocument.createElement('div');homeControls.className='jp-home-controls';
const moonIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.3A8.5 8.5 0 0 1 8.7 4 8.5 8.5 0 1 0 20 15.3Z"/></svg>';
const sunIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
homeControls.innerHTML='<button type="button" data-position-reset aria-label="图标归位" title="图标归位"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9V5h4m10 4V5h-4M5 15v4h4m10-4v4h-4"/><circle cx="12" cy="12" r="3"/></svg></button><button type="button" data-night-toggle aria-label="夜间模式" aria-pressed="false">'+moonIcon+'</button>';
$('#home').append(homeControls);
homeControls.querySelector('[data-position-reset]').onclick=()=>bridge.resetBadgePosition();
homeControls.querySelector('[data-night-toggle]').onclick=()=>bridge.setNightMode(!bridge.nightMode());
function updateTheme(){const night=!!bridge.nightMode?.();uiRoot.host.toggleAttribute('data-jp-night',night);const button=homeControls.querySelector('[data-night-toggle]');button.setAttribute('aria-pressed',String(night));button.setAttribute('aria-label',night?'日间模式':'夜间模式');button.innerHTML=night?sunIcon:moonIcon;button.title=night?'切换回日间模式':'切换到夜间模式';}
updateTheme();
