const BASE_TILE_SCALE = 0.9;
const BASE_FONT_SCALE = 0.8125;
const BASE_CLOSE_SCALE = 0.5;

async function load(){
  const data = await browser.storage.local.get([
    'theme','tileWidth','tileScale','fontScale','closeScale','rowGap','scrollSpeed',
    'showRecent','showDuplicates','enableMove',
    'keyOpenPopup','keyOpenFull','keyUnloadAll'
  ]);
  const {
    theme='light',
    tileWidth=150,
    tileScale=0.9,
    fontScale=0.8125,
    scrollSpeed=1,
    rowGap=0.1,
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
  document.getElementById('rowGap').value = rowGap;
  const uiScale = 1 + (tileScale - BASE_TILE_SCALE);
  document.getElementById('uiScale').value = uiScale.toFixed(1);
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
  document.documentElement.style.setProperty('--row-gap', rowGap + 'em');
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
  const rowGap=parseFloat(document.getElementById('rowGap').value);
  await browser.storage.local.set({
    theme, tileWidth, tileScale, fontScale, closeScale, rowGap, scrollSpeed,
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

const elTileWidth = document.getElementById('tileWidth');
const elTileScale = document.getElementById('tileScale');
const elFontScale = document.getElementById('fontScale');
const elCloseScale = document.getElementById('closeScale');
const elUIScale = document.getElementById('uiScale');
const elScrollSpeed = document.getElementById('scrollSpeed');
const elRowGap = document.getElementById('rowGap');

elTileWidth.addEventListener('input', updateWidth);
elTileWidth.addEventListener('change', updateWidth);

elTileScale.addEventListener('input', updateScale);
elTileScale.addEventListener('change', updateScale);

elFontScale.addEventListener('input', updateFont);
elFontScale.addEventListener('change', updateFont);

elCloseScale.addEventListener('input', updateCloseScale);
elCloseScale.addEventListener('change', updateCloseScale);

elRowGap.addEventListener('input', updateRowGap);
elRowGap.addEventListener('change', updateRowGap);

elUIScale.addEventListener('input', updateUIScale);
elUIScale.addEventListener('change', updateUIScale);

elScrollSpeed.addEventListener('input', updateScroll);
elScrollSpeed.addEventListener('change', updateScroll);
document.getElementById('save').addEventListener('click', save);

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.tileScale || changes.fontScale || changes.closeScale || changes.rowGap)) {
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
  }
});

let groupData = [];

async function loadGroups() {
  const { groups = [] } = await browser.runtime.sendMessage({ type: 'getGroups' });
  groupData = groups;
  renderGroups();
}

function renderGroups() {
  const container = document.getElementById('groups');
  if (!container) return;
  container.innerHTML = '';
  for (const g of groupData) {
    const row = document.createElement('div');
    const input = document.createElement('input');
    input.value = g.name;
    input.addEventListener('change', async () => {
      const newName = input.value.trim();
      if (!newName || groupData.some(gr => gr.id !== g.id && gr.name === newName)) {
        alert('Invalid or duplicate name');
        input.value = g.name;
        return;
      }
      await browser.runtime.sendMessage({ type: 'renameGroup', id: g.id, name: newName });
      loadGroups();
    });
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      if (confirm('Delete this group?')) {
        await browser.runtime.sendMessage({ type: 'deleteGroup', id: g.id });
        loadGroups();
      }
    });
    row.appendChild(input);
    row.appendChild(del);
    container.appendChild(row);
  }
}

document.getElementById('add-group').addEventListener('click', async () => {
  const name = document.getElementById('new-group').value.trim();
  if (!name || groupData.some(g => g.name === name)) {
    alert('Invalid or duplicate name');
    return;
  }
  await browser.runtime.sendMessage({ type: 'createGroup', name });
  document.getElementById('new-group').value = '';
  loadGroups();
});

loadGroups();

load();
