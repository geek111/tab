async function load(){
  const data = await browser.storage.local.get([
    'theme','tileWidth','tileScale','fontScale','closeScale','scrollSpeed',
    'showRecent','showDuplicates','enableMove',
    'keyOpenPopup','keyOpenFull','keyUnloadAll'
  ]);
  const {
    theme='light',
    tileWidth=100,
    tileScale=0.9,
    fontScale=0.8125,
    scrollSpeed=1,
    showRecent=true,
    showDuplicates=true,
    enableMove=true,
    keyOpenPopup='Alt+Shift+H',
    keyOpenFull='Alt+Shift+F',
    keyUnloadAll='Alt+Shift+U'
  } = data;
  let closeScale = data.closeScale;
  if (closeScale === undefined) {
    closeScale = 0.5;
    browser.storage.local.set({ closeScale });
  }
  document.getElementById('theme').value = theme;
  document.getElementById('tileWidth').value = tileWidth;
  document.getElementById('tileScale').value = tileScale;
  document.getElementById('fontScale').value = fontScale;
  document.getElementById('closeScale').value = closeScale;
  document.getElementById('scrollSpeed').value = scrollSpeed;
  document.getElementById('opt-show-recent').checked = showRecent;
  document.getElementById('opt-show-dups').checked = showDuplicates;
  document.getElementById('opt-enable-move').checked = enableMove;
  document.getElementById('key-open-popup').value = keyOpenPopup;
  document.getElementById('key-open-full').value = keyOpenFull;
  document.getElementById('key-unload-all').value = keyUnloadAll;
  document.documentElement.style.setProperty('--tile-width', (tileWidth * tileScale) + 'px');
  document.documentElement.style.setProperty('--tile-scale', tileScale);
  document.documentElement.style.setProperty('--font-scale', fontScale);
  document.documentElement.style.setProperty('--close-scale', closeScale);
}
async function save(){
  const theme=document.getElementById('theme').value;
  const tileWidth=parseInt(document.getElementById('tileWidth').value,10);
  const tileScale=parseFloat(document.getElementById('tileScale').value);
  const fontScale=parseFloat(document.getElementById('fontScale').value);
  const closeScale=parseFloat(document.getElementById('closeScale').value);
  const scrollSpeed=parseFloat(document.getElementById('scrollSpeed').value);
  const showRecent=document.getElementById('opt-show-recent').checked;
  const showDuplicates=document.getElementById('opt-show-dups').checked;
  const enableMove=document.getElementById('opt-enable-move').checked;
  const keyOpenPopup=document.getElementById('key-open-popup').value.trim();
  const keyOpenFull=document.getElementById('key-open-full').value.trim();
  const keyUnloadAll=document.getElementById('key-unload-all').value.trim();
  await browser.storage.local.set({
    theme, tileWidth, tileScale, fontScale, closeScale, scrollSpeed,
    showRecent, showDuplicates, enableMove,
    keyOpenPopup, keyOpenFull, keyUnloadAll
  });
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

function updateFont(){
  const fontScale=parseFloat(document.getElementById('fontScale').value);
  browser.storage.local.set({fontScale});
  document.documentElement.style.setProperty('--font-scale', fontScale);
}

function updateCloseScale(){
  const closeScale=parseFloat(document.getElementById('closeScale').value);
  browser.storage.local.set({closeScale});
  document.documentElement.style.setProperty('--close-scale', closeScale);
}

function updateScroll(){
  const scrollSpeed=parseFloat(document.getElementById('scrollSpeed').value);
  browser.storage.local.set({scrollSpeed});
}

const elTileWidth = document.getElementById('tileWidth');
const elTileScale = document.getElementById('tileScale');
const elFontScale = document.getElementById('fontScale');
const elCloseScale = document.getElementById('closeScale');
const elScrollSpeed = document.getElementById('scrollSpeed');

elTileWidth.addEventListener('input', updateWidth);
elTileWidth.addEventListener('change', updateWidth);

elTileScale.addEventListener('input', updateScale);
elTileScale.addEventListener('change', updateScale);

elFontScale.addEventListener('input', updateFont);
elFontScale.addEventListener('change', updateFont);

elCloseScale.addEventListener('input', updateCloseScale);
elCloseScale.addEventListener('change', updateCloseScale);

elScrollSpeed.addEventListener('input', updateScroll);
elScrollSpeed.addEventListener('change', updateScroll);
document.getElementById('save').addEventListener('click', save);
load();
