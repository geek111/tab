let diffFont = 0;
let diffClose = 0;

async function load(){
  const data = await browser.storage.local.get([
    'theme','tileWidth','tileScale','fontScale','closeScale','scrollSpeed',
    'showRecent','showDuplicates','enableMove',
    'keyOpenPopup','keyOpenFull','keyUnloadAll'
  ]);
  const {
    theme='light',
    tileWidth=150,
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
  diffFont = tileScale - fontScale;
  diffClose = tileScale - closeScale;
  document.getElementById('theme').value = theme;
  document.getElementById('tileWidth').value = tileWidth;
  document.getElementById('tileScale').value = tileScale;
  const elUiScale = document.getElementById('uiScale');
  if (elUiScale) {
    elUiScale.value = tileScale;
    document.getElementById('uiScaleValue').textContent = tileScale;
  }
  document.getElementById('fontScale').value = fontScale;
  document.getElementById('closeScale').value = closeScale;
  document.getElementById('scrollSpeed').value = scrollSpeed;
  document.getElementById('scrollSpeedValue').textContent = scrollSpeed;
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
  diffFont = tileScale - parseFloat(document.getElementById('fontScale').value);
  diffClose = tileScale - parseFloat(document.getElementById('closeScale').value);
  browser.storage.local.set({tileScale});
  document.documentElement.style.setProperty('--tile-width', (tileWidth * tileScale) + 'px');
  document.documentElement.style.setProperty('--tile-scale', tileScale);
  const elUi = document.getElementById('uiScale');
  if (elUi) {
    elUi.value = tileScale;
    document.getElementById('uiScaleValue').textContent = tileScale.toFixed(1);
  }
}

function updateFont(){
  const fontScale=parseFloat(document.getElementById('fontScale').value);
  diffFont = parseFloat(document.getElementById('tileScale').value) - fontScale;
  browser.storage.local.set({fontScale});
  document.documentElement.style.setProperty('--font-scale', fontScale);
  const elUi = document.getElementById('uiScale');
  if (elUi) {
    elUi.value = parseFloat(document.getElementById('tileScale').value);
    document.getElementById('uiScaleValue').textContent = elUi.value;
  }
}

function updateCloseScale(){
  const closeScale=parseFloat(document.getElementById('closeScale').value);
  diffClose = parseFloat(document.getElementById('tileScale').value) - closeScale;
  browser.storage.local.set({closeScale});
  document.documentElement.style.setProperty('--close-scale', closeScale);
  const elUi = document.getElementById('uiScale');
  if (elUi) {
    elUi.value = parseFloat(document.getElementById('tileScale').value);
    document.getElementById('uiScaleValue').textContent = elUi.value;
  }
}

function updateUiScale(){
  const uiScale = parseFloat(document.getElementById('uiScale').value);
  const tileWidth=parseInt(document.getElementById('tileWidth').value,10);
  const tileScale = uiScale;
  const fontScale = uiScale - diffFont;
  const closeScale = uiScale - diffClose;
  browser.storage.local.set({ tileScale, fontScale, closeScale });
  document.getElementById('tileScale').value = tileScale;
  document.getElementById('fontScale').value = fontScale;
  document.getElementById('closeScale').value = closeScale;
  document.getElementById('uiScaleValue').textContent = uiScale.toFixed(1);
  document.documentElement.style.setProperty('--tile-width', (tileWidth * tileScale) + 'px');
  document.documentElement.style.setProperty('--tile-scale', tileScale);
  document.documentElement.style.setProperty('--font-scale', fontScale);
  document.documentElement.style.setProperty('--close-scale', closeScale);
}

function updateScroll(){
  const el = document.getElementById('scrollSpeed');
  const scrollSpeed = parseFloat(el.value);
  browser.storage.local.set({scrollSpeed});
  document.getElementById('scrollSpeedValue').textContent = scrollSpeed.toFixed(1);
}

const elTileWidth = document.getElementById('tileWidth');
const elTileScale = document.getElementById('tileScale');
const elFontScale = document.getElementById('fontScale');
const elCloseScale = document.getElementById('closeScale');
const elScrollSpeed = document.getElementById('scrollSpeed');
const elUiScale = document.getElementById('uiScale');

elTileWidth.addEventListener('input', updateWidth);
elTileWidth.addEventListener('change', updateWidth);

elTileScale.addEventListener('input', updateScale);
elTileScale.addEventListener('change', updateScale);

elFontScale.addEventListener('input', updateFont);
elFontScale.addEventListener('change', updateFont);

elCloseScale.addEventListener('input', updateCloseScale);
elCloseScale.addEventListener('change', updateCloseScale);

if (elUiScale) {
  elUiScale.addEventListener('input', updateUiScale);
  elUiScale.addEventListener('change', updateUiScale);
}

elScrollSpeed.addEventListener('input', updateScroll);
elScrollSpeed.addEventListener('change', updateScroll);
document.getElementById('save').addEventListener('click', save);
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.tileScale) {
    const val = changes.tileScale.newValue;
    elTileScale.value = val;
    if (elUiScale) {
      elUiScale.value = val;
      document.getElementById('uiScaleValue').textContent = val.toFixed(1);
    }
  }
  if (changes.fontScale) {
    elFontScale.value = changes.fontScale.newValue;
  }
  if (changes.closeScale) {
    elCloseScale.value = changes.closeScale.newValue;
  }
});
load();
