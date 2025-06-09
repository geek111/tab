async function load(){
  const {theme='light', tileWidth=250, showRecent=true, showDuplicates=true, enableMove=true} =
    await browser.storage.local.get(['theme','tileWidth','showRecent','showDuplicates','enableMove']);
  document.getElementById('theme').value = theme;
  document.getElementById('tileWidth').value = tileWidth;
  document.getElementById('opt-show-recent').checked = showRecent;
  document.getElementById('opt-show-dups').checked = showDuplicates;
  document.getElementById('opt-enable-move').checked = enableMove;
  document.documentElement.style.setProperty('--tile-width', tileWidth + 'px');
 }
async function save(){
  const theme=document.getElementById('theme').value;
  const tileWidth=parseInt(document.getElementById('tileWidth').value,10);
  const showRecent=document.getElementById('opt-show-recent').checked;
  const showDuplicates=document.getElementById('opt-show-dups').checked;
  const enableMove=document.getElementById('opt-enable-move').checked;
  await browser.storage.local.set({theme, tileWidth, showRecent, showDuplicates, enableMove});
 }

function updateWidth(){
  const tileWidth=parseInt(document.getElementById('tileWidth').value,10);
  browser.storage.local.set({tileWidth});
}

document.getElementById('tileWidth').addEventListener('input', updateWidth);
document.getElementById('save').addEventListener('click', save);
load();
