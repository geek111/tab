let view = 'all';

async function getTabs() {
  const currentWin = await browser.windows.getCurrent();
  if (view === 'recent') {
    const { recent = [] } = await browser.runtime.sendMessage({ type: 'getRecent' });
    const result = [];
    for (const id of recent) {
      try {
        const t = await browser.tabs.get(id);
        if (t.windowId === currentWin.id) {
          result.push(t);
        }
      } catch (e) {
        // tab may no longer exist
      }
    }
    return result;
  }
  const tabs = await browser.tabs.query({ currentWindow: true });
  if (view === 'dups') {
    return findDuplicates(tabs);
  }
  return tabs;
}

function closeUI() {
  if (browser.sidebarAction) {
    try { browser.sidebarAction.close(); } catch (e) {}
  }
  window.close();
}

async function activateTab(id) {
  try {
    await browser.tabs.update(id, {active: true});
    closeUI();
  } catch (e) {
    document.getElementById('error').textContent = 'Could not activate tab';
    document.querySelector(`[data-tab="${id}"]`)?.remove();
  }
}

function createTabRow(tab, isDuplicate, activeId) {
  const div = document.createElement('div');
  div.className = 'tab';
  div.dataset.tab = tab.id;
  div.tabIndex = 0;
  if (tab.id === activeId) {
    div.classList.add('active');
  }
  if (isDuplicate) {
    div.style.backgroundColor = '#fdd';
  }

  div.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    activateTab(tab.id);
  });

  div.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      activateTab(tab.id);
    }
  });

  const title = document.createElement('span');
  title.textContent = tab.title || tab.url;
  title.className = 'tab-title';
  div.appendChild(title);
  title.onclick = () => browser.tabs.update(tab.id, {active: true});

  const btnActivate = document.createElement('button');
  btnActivate.textContent = 'Activate';
  btnActivate.onclick = () => activateTab(tab.id);
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
    const toId = parseInt(div.dataset.tab, 10);
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

function renderTabs(tabs, activeId, dupIds) {

  const container = document.getElementById('tabs');
  container.innerHTML = '';
  for (const tab of tabs) {
    const row = createTabRow(tab, dupIds.has(tab.id), activeId);
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
  const allTabs = await browser.tabs.query({ currentWindow: true });
  let tabs = await getTabs();
  const dupIds = new Set(findDuplicates(allTabs).map(t => t.id));
  const current = await browser.tabs.query({ currentWindow: true, active: true });
  const activeId = current.length ? current[0].id : -1;
  const searchInput = document.getElementById('search');
  const query = searchInput.value.trim();
  if (query) {
    tabs = filterTabs(tabs, query);
  }
  renderTabs(tabs, activeId, dupIds);
}

document.getElementById('search').addEventListener('input', update);
document.getElementById('btn-all').addEventListener('click', () => { view = 'all'; update(); });
document.getElementById('btn-recent').addEventListener('click', () => { view = 'recent'; update(); });
document.getElementById('btn-dups').addEventListener('click', () => { view = 'dups'; update(); });

document.addEventListener('keydown', (e) => {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  if (!tabs.length) return;
  if (document.activeElement.tagName === 'INPUT') return;
  let idx = tabs.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    idx = (idx + 1) % tabs.length;
    tabs[idx].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    idx = (idx - 1 + tabs.length) % tabs.length;
    tabs[idx].focus();
  } else if (e.key === 'Enter' && document.activeElement.classList.contains('tab')) {
    document.activeElement.click();
  }
});

document.addEventListener('DOMContentLoaded', update);
if (document.readyState !== 'loading') {
  update();
}

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
  return checks.map(c => parseInt(c.parentElement.dataset.tab, 10));
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
  const currentWinId = ids.length ? (await browser.tabs.get(ids[0])).windowId : null;
  const other = windows.find(w => ids.length && w.id !== currentWinId);
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
