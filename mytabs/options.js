async function load(){
  const {theme='light', tileWidth=250, tileScale=1, scrollSpeed=1, showRecent=true, showDuplicates=true, enableMove=true} =
    await browser.storage.local.get(['theme','tileWidth','tileScale','scrollSpeed','showRecent','showDuplicates','enableMove']);
  document.getElementById('theme').value = theme;
  document.getElementById('tileWidth').value = tileWidth;
  document.getElementById('tileScale').value = tileScale;
  document.getElementById('scrollSpeed').value = scrollSpeed;
  document.getElementById('opt-show-recent').checked = showRecent;
  document.getElementById('opt-show-dups').checked = showDuplicates;
  document.getElementById('opt-enable-move').checked = enableMove;
  document.documentElement.style.setProperty('--tile-width', (tileWidth * tileScale) + 'px');
  document.documentElement.style.setProperty('--tile-scale', tileScale);
 }
async function save(){
  const theme=document.getElementById('theme').value;
  const tileWidth=parseInt(document.getElementById('tileWidth').value,10);
  const tileScale=parseFloat(document.getElementById('tileScale').value);
  const scrollSpeed=parseFloat(document.getElementById('scrollSpeed').value);
  const showRecent=document.getElementById('opt-show-recent').checked;
  const showDuplicates=document.getElementById('opt-show-dups').checked;
  const enableMove=document.getElementById('opt-enable-move').checked;
  await browser.storage.local.set({theme, tileWidth, tileScale, scrollSpeed, showRecent, showDuplicates, enableMove});
}

function updateWidth(){
  const tileWidth=parseInt(document.getElementById('tileWidth').value,10);
  const tileScale=parseFloat(document.getElementById('tileScale').value);
  browser.storage.local.set({tileWidth});
  document.documentElement.style.setProperty('--tile-width', (tileWidth * tileScale) + 'px');
  document.documentElement.style.setProperty('--tile-scale', tileScale);
}

function updateScale(){
  const tileScale=parseFloat(document.getElementById('tileScale').value);
  const tileWidth=parseInt(document.getElementById('tileWidth').value,10);
  browser.storage.local.set({tileScale});
  document.documentElement.style.setProperty('--tile-width', (tileWidth * tileScale) + 'px');
  document.documentElement.style.setProperty('--tile-scale', tileScale);
}

function updateScroll(){
  const scrollSpeed=parseFloat(document.getElementById('scrollSpeed').value);
  browser.storage.local.set({scrollSpeed});
}

document.getElementById('tileWidth').addEventListener('input', updateWidth);
document.getElementById('tileScale').addEventListener('input', updateScale);
document.getElementById('scrollSpeed').addEventListener('input', updateScroll);
document.getElementById('save').addEventListener('click', save);
load();
