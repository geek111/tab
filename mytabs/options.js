const BASE_TILE_SCALE = 0.9;
const BASE_FONT_SCALE = 0.8125;
const BASE_CLOSE_SCALE = 1.55;

const DEFAULTS = {
  theme: 'light',
  tileWidth: 255,
  tileScale: 0.9,
  fontScale: 0.8125,
  closeScale: 1.55,
  uiScale: 1,
  rowGap: 0,
  scrollSpeed: 1,
  'opt-show-recent': true,
  'opt-show-dups': true,
  'opt-enable-move': true,
  'opt-auto-unload': false,
  'opt-auto-unload-mins': 60,
  'opt-disable-effects': false,
  'key-open-popup': 'Alt+Shift+H',
  'key-open-full': 'Alt+Shift+F',
  'key-unload-all': 'Alt+Shift+U',
  'key-view-all': 'Shift+A',
  'key-view-recent': 'Shift+R',
  'key-view-dups': 'Shift+D'
};

async function load(){
  const data = await browser.storage.local.get([
    'theme','tileWidth','tileScale','fontScale','closeScale','rowGap','scrollSpeed',
    'showRecent','showDuplicates','enableMove','autoUnload','autoUnloadMinutes','disableEffects',
    'keyOpenPopup','keyOpenFull','keyUnloadAll',
    'keyViewAll','keyViewRecent','keyViewDups'
  ]);
  const {
    theme='light',
    tileWidth=255,
    tileScale=0.9,
    fontScale=0.8125,
    scrollSpeed=1,
    rowGap=0,
    showRecent=true,
    showDuplicates=true,
    enableMove=true,
    autoUnload=false,
    autoUnloadMinutes=60,
    disableEffects=false,
    keyOpenPopup='Alt+Shift+H',
    keyOpenFull='Alt+Shift+F',
    keyUnloadAll='Alt+Shift+U',
    keyViewAll='Shift+A',
    keyViewRecent='Shift+R',
    keyViewDups='Shift+D'
  } = data;
  let closeScale = data.closeScale;
  if (closeScale === undefined) {
    closeScale = 1.55;
    browser.storage.local.set({ closeScale });
  }
  document.getElementById('theme').value = theme;
  document.getElementById('tileWidth').value = tileWidth;
  document.getElementById('tileScale').value = tileScale;
  document.getElementById('fontScale').value = fontScale;
  document.getElementById('closeScale').value = closeScale;
  document.getElementById('rowGap').value = rowGap;
  const uiScale = 1 + (tileScale - BASE_TILE_SCALE);
  document.getElementById('uiScale').value = uiScale.toFixed(1);
  document.getElementById('scrollSpeed').value = scrollSpeed;
  document.getElementById('scrollSpeedValue').textContent = scrollSpeed;
  document.getElementById('opt-show-recent').checked = showRecent;
  document.getElementById('opt-show-dups').checked = showDuplicates;
  document.getElementById('opt-enable-move').checked = enableMove;
  document.getElementById('opt-auto-unload').checked = autoUnload;
  document.getElementById('opt-auto-unload-mins').value = autoUnloadMinutes;
  document.getElementById('opt-auto-unload-mins').disabled = !autoUnload;
  document.getElementById('opt-disable-effects').checked = disableEffects;
  document.getElementById('key-open-popup').value = keyOpenPopup;
  document.getElementById('key-open-full').value = keyOpenFull;
  document.getElementById('key-unload-all').value = keyUnloadAll;
  document.getElementById('key-view-all').value = keyViewAll;
  document.getElementById('key-view-recent').value = keyViewRecent;
  document.getElementById('key-view-dups').value = keyViewDups;
  document.documentElement.style.setProperty('--tile-width', (tileWidth * tileScale) + 'px');
  document.documentElement.style.setProperty('--tile-scale', tileScale);
  document.documentElement.style.setProperty('--font-scale', fontScale);
  document.documentElement.style.setProperty('--close-scale', closeScale);
  document.documentElement.style.setProperty('--row-gap', rowGap + 'em');
  Object.keys(DEFAULTS).forEach(checkDefault);
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
  const autoUnload=document.getElementById('opt-auto-unload').checked;
  const autoUnloadMinutes=parseInt(document.getElementById('opt-auto-unload-mins').value,10);
  const keyOpenPopup=document.getElementById('key-open-popup').value.trim();
  const keyOpenFull=document.getElementById('key-open-full').value.trim();
  const keyUnloadAll=document.getElementById('key-unload-all').value.trim();
  const keyViewAll=document.getElementById('key-view-all').value.trim();
  const keyViewRecent=document.getElementById('key-view-recent').value.trim();
  const keyViewDups=document.getElementById('key-view-dups').value.trim();
  const disableEffects=document.getElementById('opt-disable-effects').checked;
  const rowGap=parseFloat(document.getElementById('rowGap').value);
  await browser.storage.local.set({
    theme, tileWidth, tileScale, fontScale, closeScale, rowGap, scrollSpeed,
    showRecent, showDuplicates, enableMove, autoUnload, autoUnloadMinutes, disableEffects,
    keyOpenPopup, keyOpenFull, keyUnloadAll,
    keyViewAll, keyViewRecent, keyViewDups
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

function updateRowGap(){
  const rowGap=parseFloat(document.getElementById('rowGap').value);
  browser.storage.local.set({rowGap});
  document.documentElement.style.setProperty('--row-gap', rowGap + 'em');
}

function updateUIScale(){
  const uiScale = parseFloat(document.getElementById('uiScale').value);
  const diff = uiScale - 1;
  const tileScale = Math.min(2, Math.max(0.5, BASE_TILE_SCALE + diff));
  const fontScale = Math.min(2, Math.max(0.5, BASE_FONT_SCALE + diff));
  const closeScale = Math.min(2, Math.max(0.25, BASE_CLOSE_SCALE + diff));
  browser.storage.local.set({tileScale, fontScale, closeScale});
  document.getElementById('tileScale').value = tileScale;
  document.getElementById('fontScale').value = fontScale;
  document.getElementById('closeScale').value = closeScale;
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

function formatShortcut(evt){
  const mods=[];
  if(evt.ctrlKey) mods.push('Ctrl');
  if(evt.altKey) mods.push('Alt');
  if(evt.metaKey) mods.push('Meta');
  if(evt.shiftKey) mods.push('Shift');
  let key=evt.key;
  if(key.length===1) key=key.toUpperCase();
  return [...mods, key].join('+');
}

function handleShortcutInput(e){
  if(['Shift','Control','Alt','Meta'].includes(e.key)){
    e.preventDefault();
    return;
  }
  e.preventDefault();
  e.target.value=formatShortcut(e);
  checkDefault(e.target.id);
}

const elTileWidth = document.getElementById('tileWidth');
const elTileScale = document.getElementById('tileScale');
const elFontScale = document.getElementById('fontScale');
const elCloseScale = document.getElementById('closeScale');
const elUIScale = document.getElementById('uiScale');
const elScrollSpeed = document.getElementById('scrollSpeed');
const elRowGap = document.getElementById('rowGap');
const elAutoUnload = document.getElementById('opt-auto-unload');
const elAutoUnloadMins = document.getElementById('opt-auto-unload-mins');
const elShowRecent = document.getElementById('opt-show-recent');
const elShowDups = document.getElementById('opt-show-dups');
const elEnableMove = document.getElementById('opt-enable-move');
const elDisableEffects = document.getElementById('opt-disable-effects');

const updateMap = {
  tileWidth: updateWidth,
  tileScale: updateScale,
  fontScale: updateFont,
  closeScale: updateCloseScale,
  uiScale: updateUIScale,
  rowGap: updateRowGap,
  scrollSpeed: updateScroll
};

function checkDefault(id) {
  const input = document.getElementById(id);
  const btn = document.querySelector(`button[data-for="${id}"]`);
  if (!input || !btn) return;
  let val;
  if (input.type === 'checkbox') {
    val = input.checked;
  } else {
    val = input.value;
    if (input.type === 'number' || input.type === 'range') {
      val = parseFloat(val);
    }
  }
  btn.disabled = val === DEFAULTS[id];
}

document.querySelectorAll('.default-btn').forEach(btn => {
  const id = btn.dataset.for;
  btn.addEventListener('click', () => {
    const input = document.getElementById(id);
    if (!input) return;
    const val = DEFAULTS[id];
    if (input.type === 'checkbox') {
      input.checked = val;
      browser.storage.local.set({ [id]: val });
    } else {
      input.value = val;
      if (updateMap[id]) {
        updateMap[id]();
      }
    }
    checkDefault(id);
    if (id === 'uiScale') {
      checkDefault('tileScale');
      checkDefault('fontScale');
      checkDefault('closeScale');
    }
  });
});

elTileWidth.addEventListener('input', () => { updateWidth(); checkDefault('tileWidth'); });
elTileWidth.addEventListener('change', () => { updateWidth(); checkDefault('tileWidth'); });

elTileScale.addEventListener('input', () => { updateScale(); checkDefault('tileScale'); });
elTileScale.addEventListener('change', () => { updateScale(); checkDefault('tileScale'); });

elFontScale.addEventListener('input', () => { updateFont(); checkDefault('fontScale'); });
elFontScale.addEventListener('change', () => { updateFont(); checkDefault('fontScale'); });

elCloseScale.addEventListener('input', () => { updateCloseScale(); checkDefault('closeScale'); });
elCloseScale.addEventListener('change', () => { updateCloseScale(); checkDefault('closeScale'); });

elRowGap.addEventListener('input', () => { updateRowGap(); checkDefault('rowGap'); });
elRowGap.addEventListener('change', () => { updateRowGap(); checkDefault('rowGap'); });

elAutoUnloadMins.addEventListener('input', () => checkDefault('opt-auto-unload-mins'));
elAutoUnloadMins.addEventListener('change', () => checkDefault('opt-auto-unload-mins'));

elShowRecent.addEventListener('change', () => {
  browser.storage.local.set({ 'opt-show-recent': elShowRecent.checked });
  checkDefault('opt-show-recent');
});

elShowDups.addEventListener('change', () => {
  browser.storage.local.set({ 'opt-show-dups': elShowDups.checked });
  checkDefault('opt-show-dups');
});

elEnableMove.addEventListener('change', () => {
  browser.storage.local.set({ 'opt-enable-move': elEnableMove.checked });
  checkDefault('opt-enable-move');
});

elDisableEffects.addEventListener('change', () => {
  browser.storage.local.set({ disableEffects: elDisableEffects.checked });
  checkDefault('opt-disable-effects');
});

elAutoUnload.addEventListener('change', () => {
  elAutoUnloadMins.disabled = !elAutoUnload.checked;
  browser.storage.local.set({ 'opt-auto-unload': elAutoUnload.checked });
  checkDefault('opt-auto-unload');
});

elUIScale.addEventListener('input', () => { updateUIScale(); checkDefault('uiScale'); });
elUIScale.addEventListener('change', () => { updateUIScale(); checkDefault('uiScale'); });

elScrollSpeed.addEventListener('input', () => { updateScroll(); checkDefault('scrollSpeed'); });
elScrollSpeed.addEventListener('change', () => { updateScroll(); checkDefault('scrollSpeed'); });
document.getElementById('save').addEventListener('click', save);

document.querySelectorAll('input[id^="key-"]').forEach(el => {
  el.addEventListener('keydown', handleShortcutInput);
  el.addEventListener('focus', () => el.select());
  el.addEventListener('input', () => checkDefault(el.id));
  el.addEventListener('change', () => checkDefault(el.id));
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.tileScale || changes.fontScale || changes.closeScale || changes.rowGap || changes.autoUnload || changes.autoUnloadMinutes || changes.disableEffects)) {
    const tileScale = changes.tileScale ? changes.tileScale.newValue : parseFloat(document.getElementById('tileScale').value);
    const fontScale = changes.fontScale ? changes.fontScale.newValue : parseFloat(document.getElementById('fontScale').value);
    const closeScale = changes.closeScale ? changes.closeScale.newValue : parseFloat(document.getElementById('closeScale').value);
    document.getElementById('tileScale').value = tileScale;
    document.getElementById('fontScale').value = fontScale;
    document.getElementById('closeScale').value = closeScale;
    document.documentElement.style.setProperty('--tile-scale', tileScale);
    document.documentElement.style.setProperty('--font-scale', fontScale);
    document.documentElement.style.setProperty('--close-scale', closeScale);
    if (changes.rowGap) {
      document.getElementById('rowGap').value = changes.rowGap.newValue;
      document.documentElement.style.setProperty('--row-gap', changes.rowGap.newValue + 'em');
    }
    const uiScale = 1 + (tileScale - BASE_TILE_SCALE);
    document.getElementById('uiScale').value = uiScale.toFixed(1);
    if (changes.autoUnload) {
      elAutoUnload.checked = changes.autoUnload.newValue;
      elAutoUnloadMins.disabled = !elAutoUnload.checked;
      checkDefault('opt-auto-unload');
    }
    if (changes.autoUnloadMinutes) {
      elAutoUnloadMins.value = changes.autoUnloadMinutes.newValue;
      checkDefault('opt-auto-unload-mins');
    }
    checkDefault('tileScale');
    checkDefault('fontScale');
    checkDefault('closeScale');
    checkDefault('rowGap');
    checkDefault('uiScale');
    if (changes.disableEffects) {
      elDisableEffects.checked = changes.disableEffects.newValue;
      checkDefault('opt-disable-effects');
    }
  }
});

load();
function displayVersion() {
  const el = document.getElementById('addon-version');
  if (el) {
    const version = browser.runtime.getManifest().version;
    el.textContent = `Version ${version}`;
  }
}

displayVersion();
