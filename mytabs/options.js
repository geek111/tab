async function load(){
  const {
    theme='light', cols=3, tileWidth=250,
    showRecent=true, showDuplicates=true, enableMove=true,
    enablePreviews=false, enableSession=false, enableExport=false,
    enableContainers=false, enablePin=false, enableResource=false,
    autoSuspend=false, autoSuspendMin=10
  } = await browser.storage.local.get([
    'theme','cols','tileWidth','showRecent','showDuplicates','enableMove',
    'enablePreviews','enableSession','enableExport','enableContainers',
    'enablePin','enableResource','autoSuspend','autoSuspendMin'
  ]);
  document.getElementById('theme').value = theme;
  document.getElementById('cols').value = cols;
  document.getElementById('tileWidth').value = tileWidth;
  document.getElementById('opt-show-recent').checked = showRecent;
  document.getElementById('opt-show-dups').checked = showDuplicates;
  document.getElementById('opt-enable-move').checked = enableMove;
  document.getElementById('opt-enable-previews').checked = enablePreviews;
  document.getElementById('opt-enable-session').checked = enableSession;
  document.getElementById('opt-enable-export').checked = enableExport;
  document.getElementById('opt-enable-containers').checked = enableContainers;
  document.getElementById('opt-enable-pin').checked = enablePin;
  document.getElementById('opt-enable-resource').checked = enableResource;
  document.getElementById('opt-auto-suspend').checked = autoSuspend;
  document.getElementById('auto-suspend-min').value = autoSuspendMin;
}
async function save(){
  const theme=document.getElementById('theme').value;
  const cols=parseInt(document.getElementById('cols').value,10);
  const tileWidth=parseInt(document.getElementById('tileWidth').value,10);
  const showRecent=document.getElementById('opt-show-recent').checked;
  const showDuplicates=document.getElementById('opt-show-dups').checked;
  const enableMove=document.getElementById('opt-enable-move').checked;
  const enablePreviews=document.getElementById('opt-enable-previews').checked;
  const enableSession=document.getElementById('opt-enable-session').checked;
  const enableExport=document.getElementById('opt-enable-export').checked;
  const enableContainers=document.getElementById('opt-enable-containers').checked;
  const enablePin=document.getElementById('opt-enable-pin').checked;
  const enableResource=document.getElementById('opt-enable-resource').checked;
  const autoSuspend=document.getElementById('opt-auto-suspend').checked;
  const autoSuspendMin=parseInt(document.getElementById('auto-suspend-min').value,10);
  await browser.storage.local.set({theme, cols, tileWidth, showRecent, showDuplicates, enableMove,
    enablePreviews, enableSession, enableExport, enableContainers, enablePin, enableResource,
    autoSuspend, autoSuspendMin});
}
document.getElementById('save').addEventListener('click', save);
load();
