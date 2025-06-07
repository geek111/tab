// Shared script used by popup.html and sidebar.html
let view = 'all';
let restored = false;
const MOVE_ENABLED = false;

let lastSelectedIndex = -1;
let container; // tabs container cached after DOM load

function throttle(fn) {
  let pending = false;
  return (...args) => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fn(...args);
      });
    }
  };
}

function updateSelection(row, selected) {
  const check = row.querySelector('.sel');
  if (check) {
    check.checked = selected;
  }
  row.classList.toggle('selected', selected);
}

function saveScroll() {
  if (container) {
    browser.storage.local.set({ scrollTop: container.scrollTop });
  }
}

async function restoreScroll() {
  if (restored) return;
  const { scrollTop = 0 } = await browser.storage.local.get('scrollTop');
  if (container) {
    container.scrollTop = scrollTop;
  }
  restored = true;
}

async function getTabs(allTabs) {
  if (view === 'recent') {
    const { recent = [] } = await browser.runtime.sendMessage({ type: 'getRecent' });
    const result = [];
    for (const id of recent) {
      try {
        const t = await browser.tabs.get(id);
        result.push(t);
      } catch (_) {
        // tab may no longer exist
      }
    }
    return result;
  }
  if (view === 'dups') {
    return findDuplicates(allTabs);
  }
  return allTabs;
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
        const select = !check.checked;
        for (let i = start; i <= end; i++) {
          updateSelection(tabs[i], select);
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
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        activateTab(tab.id);
      } else {
        e.preventDefault();
      }
    }
  });

  const title = document.createElement('span');
  title.textContent = tab.title || tab.url;
  title.className = 'tab-title';
  div.appendChild(title);


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
      scheduleUpdate();
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
  if (!container) return;
  container.innerHTML = '';
  if (!tabs.length) {
    const msg = document.createElement('div');
    msg.id = 'empty';
    msg.textContent = 'No tabs to display';
    container.appendChild(msg);
    return;
  }
  const frag = document.createDocumentFragment();
  for (const tab of tabs) {
    const row = createTabRow(tab, dupIds.has(tab.id), activeId, visitedIds.has(tab.id));
    frag.appendChild(row);
  }
  container.appendChild(frag);
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
  // Query all tabs across every Firefox window
  const allTabs = await browser.tabs.query({});
  document.getElementById('total-count').textContent = allTabs.length;
  const activeCount = allTabs.filter(t => !t.discarded).length;
  document.getElementById('active-count').textContent = activeCount;
  let tabs = await getTabs(allTabs);
  const dupIds = new Set(findDuplicates(allTabs).map(t => t.id));
  const activeId = allTabs.find(t => t.active)?.id ?? -1;
  const { visited = [] } = await browser.runtime.sendMessage({ type: 'getVisited' });
  const visitedIds = new Set(visited);
  const searchInput = document.getElementById('search');
  const query = searchInput.value.trim();
  if (query) {
    tabs = filterTabs(tabs, query);
  }
  renderTabs(tabs, activeId, dupIds, visitedIds);
}

const scheduleUpdate = throttle(update);

document.getElementById('search').addEventListener('input', scheduleUpdate);
document.getElementById('btn-all').addEventListener('click', () => { view = 'all'; scheduleUpdate(); });
document.getElementById('btn-recent').addEventListener('click', () => { view = 'recent'; scheduleUpdate(); });
document.getElementById('btn-dups').addEventListener('click', () => { view = 'dups'; scheduleUpdate(); });

document.addEventListener('keydown', (e) => {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  if (!tabs.length) return;
  if (document.activeElement.tagName === 'INPUT') return;
  const focused = document.activeElement;
  const isTab = focused.classList.contains('tab');
  let idx = tabs.indexOf(focused);

  const moveFocus = (delta) => {
    const newIdx = Math.min(Math.max(idx + delta, 0), tabs.length - 1);
    tabs[newIdx].focus();
    idx = newIdx;
    return newIdx;
  };

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const oldIdx = idx;
    const newIdx = moveFocus(e.key === 'ArrowDown' ? 1 : -1);
    if (e.shiftKey && isTab) {
      if (lastSelectedIndex === -1) lastSelectedIndex = oldIdx;
      const start = Math.min(lastSelectedIndex, newIdx);
      const end = Math.max(lastSelectedIndex, newIdx);
      tabs.forEach((t, i) => updateSelection(t, i >= start && i <= end));
    } else if (!e.ctrlKey && !e.metaKey) {
      tabs.forEach(t => updateSelection(t, false));
      updateSelection(tabs[newIdx], true);
      lastSelectedIndex = newIdx;
    } else {
      lastSelectedIndex = newIdx;
    }
  } else if (e.key === ' ' && isTab) {
    e.preventDefault();
    updateSelection(focused, !focused.querySelector('.sel').checked);
    lastSelectedIndex = tabs.indexOf(focused);
  } else if (e.key === 'Enter' && isTab) {
    focused.click();
  }
});

async function init() {
  container = document.getElementById('tabs');
  container.addEventListener('scroll', saveScroll);
  container.addEventListener('contextmenu', showContextMenu);
  await update();
  restoreScroll();
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') {
  init();
}

// custom context menu
const context = document.getElementById('context');
function showContextMenu(e) {
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
    addItem('Unload Selected', bulkDiscard);
    if (MOVE_ENABLED) addItem('Move Selected', bulkMove);
  }

  if (tabEl && (!selected.length || !tabEl.querySelector('.sel').checked)) {
    const id = parseInt(tabEl.dataset.tab, 10);
    addItem('Activate', () => activateTab(id));
    addItem('Unload', async () => { await browser.tabs.discard(id); scheduleUpdate(); });
    addItem('Close', async () => { await browser.tabs.remove(id); scheduleUpdate(); });
    if (MOVE_ENABLED) {
      addItem('Move', async () => {
        const t = await browser.tabs.get(id);
        const wins = await browser.windows.getAll({populate: false});
        const other = wins.find(w => w.id !== t.windowId);
        if (other) await browser.tabs.move(id, {windowId: other.id, index: -1});
        scheduleUpdate();
      });
    }
  }

  if (!tabEl && !selected.length) {
    context.textContent = `My Tabs Helper v${browser.runtime.getManifest().version}`;
  }

  context.style.left = e.pageX + 'px';
  context.style.top = e.pageY + 'px';
  context.classList.remove('hidden');
}

document.addEventListener('click', () => context.classList.add('hidden'));

function getSelectedTabIds() {
  const checks = Array.from(document.querySelectorAll('.sel:checked'));
  return checks.map(c => parseInt(c.parentElement.dataset.tab, 10));
}

async function bulkClose() {
  const ids = getSelectedTabIds();
  if (ids.length) await browser.tabs.remove(ids);
  scheduleUpdate();
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
  scheduleUpdate();
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
  scheduleUpdate();
}

const bulkCloseBtn = document.getElementById('bulk-close');
if (bulkCloseBtn) bulkCloseBtn.addEventListener('click', bulkClose);

const bulkReloadBtn = document.getElementById('bulk-reload');
if (bulkReloadBtn) bulkReloadBtn.addEventListener('click', bulkReload);

const bulkDiscardBtn = document.getElementById('bulk-discard');
if (bulkDiscardBtn) bulkDiscardBtn.addEventListener('click', bulkDiscard);

const moveBtn = document.getElementById('bulk-move');
if (MOVE_ENABLED && moveBtn) moveBtn.addEventListener('click', bulkMove);
else if (moveBtn) moveBtn.style.display = 'none';
