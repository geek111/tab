async function getTabs() {
  const tabs = await browser.tabs.query({});
  return tabs;
}

async function getRecentTabs() {
  const { recent = [] } = await browser.runtime.sendMessage({ type: 'getRecent' });
  if (!recent.length) return [];
  const tabs = await browser.tabs.query({});
  const map = new Map(tabs.map(t => [t.id, t]));
  return recent.map(id => map.get(id)).filter(Boolean);
}

let mode = 'all';

function createTabRow(tab, isDuplicate) {
  const div = document.createElement('div');
  div.className = 'tab';
  div.draggable = true;
  if (isDuplicate) {
    div.style.backgroundColor = '#fdd';
  }

  div.dataset.id = tab.id;

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'sel';
  check.addEventListener('change', () => {
    const any = document.querySelector('.sel:checked');
    document.getElementById('bulk').classList.toggle('hidden', !any);
  });
  div.appendChild(check);

  const title = document.createElement('span');
  title.textContent = tab.title || tab.url;
  title.className = 'tab-title';
  div.appendChild(title);
  title.onclick = () => browser.tabs.update(tab.id, {active: true});

  const btnActivate = document.createElement('button');
  btnActivate.textContent = 'Activate';
  btnActivate.onclick = () => browser.tabs.update(tab.id, {active: true});
  div.appendChild(btnActivate);

  const btnUnload = document.createElement('button');
  btnUnload.textContent = 'Unload';
  btnUnload.onclick = () => browser.tabs.discard(tab.id);
  div.appendChild(btnUnload);

  const btnClose = document.createElement('button');
  btnClose.textContent = 'Close';
  btnClose.onclick = () => browser.tabs.remove(tab.id);
  div.appendChild(btnClose);

  const btnMove = document.createElement('button');
  btnMove.textContent = 'Move';
  btnMove.onclick = async () => {
    const windows = await browser.windows.getAll({populate: false});
    const other = windows.find(w => w.id !== tab.windowId);
    if (other) {
      await browser.tabs.move(tab.id, {windowId: other.id, index: -1});
    }
  };
  div.appendChild(btnMove);

  div.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', tab.id);
  });

  div.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  div.addEventListener('drop', async (e) => {
    e.preventDefault();
    const fromId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const toId = parseInt(div.dataset.id, 10);
    if (fromId !== toId) {
      const toTab = await browser.tabs.get(toId);
      await browser.tabs.move(fromId, {index: toTab.index});
      update();
    }
  });

  div.addEventListener('dblclick', async () => {
    const query = prompt('Search text');
    if (query) {
      await browser.tabs.sendMessage(tab.id, { type: 'highlight', query });
      browser.tabs.update(tab.id, { active: true });
    }
  });

  return div;
}

function renderTabs(tabs) {
  const duplicates = findDuplicates(tabs);
  const dupIds = new Set(duplicates.map(t => t.id));

  const container = document.getElementById('tabs');
  container.innerHTML = '';
  for (const tab of tabs) {
    const row = createTabRow(tab, dupIds.has(tab.id));
    container.appendChild(row);
  }
}

function filterTabs(tabs, query) {
  const q = query.toLowerCase();
  return tabs.filter(t => (t.title && t.title.toLowerCase().includes(q)) ||
                         (t.url && t.url.toLowerCase().includes(q)));
}

function findDuplicates(tabs) {
  const map = new Map();
  const duplicates = [];
  for (const tab of tabs) {
    if (map.has(tab.url)) {
      duplicates.push(tab);
    } else {
      map.set(tab.url, tab);
    }
  }
  return duplicates;
}

async function update() {
  let tabs;
  if (mode === 'recent') {
    tabs = await getRecentTabs();
  } else {
    tabs = await getTabs();
  }

  if (mode === 'duplicates') {
    const dups = findDuplicates(tabs);
    tabs = dups;
  }

  const searchInput = document.getElementById('search');
  const query = searchInput.value.trim();
  if (query) {
    tabs = filterTabs(tabs, query);
  }
  renderTabs(tabs);
}

document.getElementById('search').addEventListener('input', update);

document.getElementById('btn-all').addEventListener('click', () => { mode = 'all'; update(); });
document.getElementById('btn-recent').addEventListener('click', () => { mode = 'recent'; update(); });
document.getElementById('btn-dups').addEventListener('click', () => { mode = 'duplicates'; update(); });

document.addEventListener('DOMContentLoaded', update);

// custom context menu
const context = document.getElementById('context');
document.getElementById('tabs').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  context.textContent = `My Tabs Helper v${browser.runtime.getManifest().version}`;
  context.style.left = e.pageX + 'px';
  context.style.top = e.pageY + 'px';
  context.classList.remove('hidden');
});

document.addEventListener('click', () => context.classList.add('hidden'));

function getSelectedTabIds() {
  const checks = Array.from(document.querySelectorAll('.sel:checked'));
  return checks.map(c => parseInt(c.parentElement.dataset.id, 10));
}

async function bulkClose() {
  const ids = getSelectedTabIds();
  if (ids.length) await browser.tabs.remove(ids);
  update();
}

async function bulkReload() {
  const ids = getSelectedTabIds();
  for (const id of ids) {
    await browser.tabs.reload(id);
  }
}

async function bulkDiscard() {
  const ids = getSelectedTabIds();
  for (const id of ids) {
    await browser.tabs.discard(id);
  }
}

async function bulkMove() {
  const ids = getSelectedTabIds();
  const windows = await browser.windows.getAll({populate: false});
  const other = windows.find(w => ids.length && w.id !== (await browser.tabs.get(ids[0])).windowId);
  if (other) {
    for (const id of ids) {
      await browser.tabs.move(id, {windowId: other.id, index: -1});
    }
  }
  update();
}

document.getElementById('bulk-close').addEventListener('click', bulkClose);
document.getElementById('bulk-reload').addEventListener('click', bulkReload);
document.getElementById('bulk-discard').addEventListener('click', bulkDiscard);
document.getElementById('bulk-move').addEventListener('click', bulkMove);
