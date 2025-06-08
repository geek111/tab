async function load(){
  const {theme='light', cols=3, tileWidth=250, showRecent=true, showDuplicates=true, enableMove=true} =
    await browser.storage.local.get(['theme','cols','tileWidth','showRecent','showDuplicates','enableMove']);
  document.getElementById('theme').value = theme;
  document.getElementById('cols').value = cols;
  document.getElementById('tileWidth').value = tileWidth;
  document.getElementById('opt-show-recent').checked = showRecent;
  document.getElementById('opt-show-dups').checked = showDuplicates;
  document.getElementById('opt-enable-move').checked = enableMove;
}
async function save(){
  const theme=document.getElementById('theme').value;
  const cols=parseInt(document.getElementById('cols').value,10);
  const tileWidth=parseInt(document.getElementById('tileWidth').value,10);
  const showRecent=document.getElementById('opt-show-recent').checked;
  const showDuplicates=document.getElementById('opt-show-dups').checked;
  const enableMove=document.getElementById('opt-enable-move').checked;
  await browser.storage.local.set({theme, cols, tileWidth, showRecent, showDuplicates, enableMove});
}
document.getElementById('save').addEventListener('click', save);
load();
