let view = 'all';
let restored = false;
const MOVE_ENABLED = false;

let lastSelectedIndex = -1;

function updateSelection(row, selected) {
  const check = row.querySelector('.sel');
  if (check) {
    check.checked = selected;
  }
  row.classList.toggle('selected', selected);
}

function saveScroll() {
  const container = document.getElementById('tabs');
  if (container) {
    browser.storage.local.set({ scrollTop: container.scrollTop });
  }
}

async function restoreScroll() {
  if (restored) return;
  const { scrollTop = 0 } = await browser.storage.local.get('scrollTop');
  const container = document.getElementById('tabs');
  if (container) {
    container.scrollTop = scrollTop;
  }
  restored = true;
}

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

function createTabRow(tab, isDuplicate, activeId, isVisited) {
  const div = document.createElement('div');
  div.className = 'tab';
  div.dataset.tab = tab.id;
  div.tabIndex = 0;
  div.draggable = true;
  if (tab.id === activeId) {
    div.classList.add('active');
  }
  if (isDuplicate) {
    div.classList.add('duplicate');
  }
  if (isVisited && !tab.discarded) {
    div.classList.add('visited');
  }

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'sel';
  div.appendChild(check);
  check.addEventListener('change', () => {
    div.classList.toggle('selected', check.checked);
    const tabs = Array.from(document.querySelectorAll('.tab'));
    lastSelectedIndex = tabs.indexOf(div);
  });

  if (tab.favIconUrl) {
    const icon = document.createElement('img');
    icon.className = 'tab-icon';
    icon.src = tab.favIconUrl;
    icon.alt = '';
    icon.onerror = () => icon.remove();
    div.appendChild(icon);
  }

  div.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    if (e.target.classList.contains('sel')) return;
    const tabs = Array.from(document.querySelectorAll('.tab'));
    const idx = tabs.indexOf(div);
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault();
      if (e.shiftKey && lastSelectedIndex !== -1) {
        const start = Math.min(lastSelectedIndex, idx);
        const end = Math.max(lastSelectedIndex, idx);
        for (let i = start; i <= end; i++) {
          updateSelection(tabs[i], true);
        }
      } else {
        updateSelection(div, !check.checked);
      }
      lastSelectedIndex = idx;
      return;
    }
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

function renderTabs(tabs, activeId, dupIds, visitedIds) {

  const container = document.getElementById('tabs');
  container.innerHTML = '';
  if (!tabs.length) {
    const msg = document.createElement('div');
    msg.id = 'empty';
    msg.textContent = 'No tabs to display';
    container.appendChild(msg);
    return;
  }
  for (const tab of tabs) {
    const row = createTabRow(tab, dupIds.has(tab.id), activeId, visitedIds.has(tab.id));
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
  document.getElementById('total-count').textContent = allTabs.length;
  const activeCount = allTabs.filter(t => !t.discarded).length;
  document.getElementById('active-count').textContent = activeCount;
  let tabs = await getTabs();
  const dupIds = new Set(findDuplicates(allTabs).map(t => t.id));
  const current = await browser.tabs.query({ currentWindow: true, active: true });
  const activeId = current.length ? current[0].id : -1;
  const { visited = [] } = await browser.runtime.sendMessage({ type: 'getVisited' });
  const visitedIds = new Set(visited);
  const searchInput = document.getElementById('search');
  const query = searchInput.value.trim();
  if (query) {
    tabs = filterTabs(tabs, query);
  }
  renderTabs(tabs, activeId, dupIds, visitedIds);
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

async function init() {
  document.getElementById('tabs').addEventListener('scroll', saveScroll);
  await update();
  restoreScroll();
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') {
  init();
}

// custom context menu
const context = document.getElementById('context');
document.getElementById('tabs').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const tabEl = e.target.closest('.tab');
  context.innerHTML = '';

  const selected = getSelectedTabIds();
  const addItem = (label, fn) => {
    const item = document.createElement('div');
    item.textContent = label;
    item.addEventListener('click', async () => {
      context.classList.add('hidden');
      await fn();
    });
    context.appendChild(item);
  };

  if (selected.length) {
    addItem('Close Selected', bulkClose);
    addItem('Reload Selected', bulkReload);
    addItem('Discard Selected', bulkDiscard);
    if (MOVE_ENABLED) addItem('Move Selected', bulkMove);
  }

  if (tabEl && (!selected.length || !tabEl.querySelector('.sel').checked)) {
    const id = parseInt(tabEl.dataset.tab, 10);
    addItem('Activate', () => activateTab(id));
    addItem('Unload', async () => { await browser.tabs.discard(id); update(); });
    addItem('Close', async () => { await browser.tabs.remove(id); update(); });
    if (MOVE_ENABLED) {
      addItem('Move', async () => {
        const t = await browser.tabs.get(id);
        const wins = await browser.windows.getAll({populate: false});
        const other = wins.find(w => w.id !== t.windowId);
        if (other) await browser.tabs.move(id, {windowId: other.id, index: -1});
        update();
      });
    }
  }

  if (!tabEl && !selected.length) {
    context.textContent = `My Tabs Helper v${browser.runtime.getManifest().version}`;
  }

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
  update();
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
if (MOVE_ENABLED) {
  document.getElementById('bulk-move').addEventListener('click', bulkMove);
} else {
  document.getElementById('bulk-move').style.display = 'none';
}
