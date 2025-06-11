// Shared script used by popup.html and sidebar.html
let view = 'all';
let restored = false;
// Feature toggles loaded from storage
let SHOW_RECENT = true;
let SHOW_DUPLICATES = true;
let MOVE_ENABLED = true;
let SCROLL_SPEED = 1;

let lastSelectedIndex = -1;
let container; // tabs container cached after DOM load
let dropTarget = null;
let containerMap = new Map();
let filterContainerId = '';
let containerCache;
let targetSelect;
let visitedIds = new Set();

let virtualList = null;
let tabItems = [];
let idIndexMap = new Map();
let rowHeight = 0;
let currentDupIds = new Set();
let currentActiveId = -1;
let currentVisited = new Set();
let currentWinMap = null;
let currentQuery = '';

function resetTabState() {
  if (virtualList) {
    virtualList.destroy();
  }
  virtualList = null;
  tabItems = [];
  idIndexMap = new Map();
  rowHeight = 0;
  currentDupIds = new Set();
  currentActiveId = -1;
  currentVisited = new Set();
  currentWinMap = null;
  currentQuery = '';
}
function clearPlaceholder() {
  if (dropTarget) {
    dropTarget.classList.remove('drop-before', 'drop-after');
    dropTarget = null;
  }
}

function showPlaceholder(target, before) {
  if (dropTarget === target &&
      target.classList.contains(before ? 'drop-before' : 'drop-after')) {
    return;
  }
  clearPlaceholder();
  dropTarget = target;
  dropTarget.classList.add(before ? 'drop-before' : 'drop-after');
}

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

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

async function loadOptions() {
  const {
    showRecent = true,
    showDuplicates = true,
    enableMove = true,
    scrollSpeed = 1,
    keyUnloadAll = 'Alt+Shift+U'
  } = await browser.storage.local.get([
    'showRecent',
    'showDuplicates',
    'enableMove',
    'scrollSpeed',
    'keyUnloadAll'
  ]);
  SHOW_RECENT = showRecent !== false;
  SHOW_DUPLICATES = showDuplicates !== false;
  MOVE_ENABLED = enableMove !== false;
  SCROLL_SPEED = parseFloat(scrollSpeed) || 1;
  const btnRecent = document.getElementById('btn-recent');
  const btnDups = document.getElementById('btn-dups');
  if (btnRecent) {
    if (SHOW_RECENT) {
      btnRecent.style.display = '';
      btnRecent.addEventListener('click', () => {
        view = 'recent';
        scheduleUpdate();
      });
    } else {
      btnRecent.style.display = 'none';
      if (view === 'recent') view = 'all';
    }
  }
  if (btnDups) {
    if (SHOW_DUPLICATES) {
      btnDups.style.display = '';
      btnDups.addEventListener('click', () => {
        view = 'dups';
        scheduleUpdate();
      });
    } else {
      btnDups.style.display = 'none';
      if (view === 'dups') view = 'all';
    }
  }
  const unloadBtn = document.getElementById('bulk-unload-all');
  if (unloadBtn) unloadBtn.title = `Shortcut: ${keyUnloadAll}`;
}

function updateSelection(row, selected) {
  row.classList.toggle('selected', selected);
  if (row._item) {
    row._item.selected = selected;
  }
}

const saveScroll = debounce(() => {
  if (container) {
    browser.storage.local.set({ scrollTop: container.scrollTop });
  }
}, 200);

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
    let currentWin = null;
    if (!document.body.classList.contains('full')) {
      currentWin = await browser.windows.getLastFocused({windowTypes: ['normal']});
    }
    for (const id of recent) {
      try {
        const t = await browser.tabs.get(id);
        if (!currentWin || t.windowId === currentWin.id) {
          result.push(t);
        }
      } catch (_) {
        // tab may no longer exist
      }
    }
    return result;
  }
  if (view === 'dups') {
    const { duplicates = [] } = await browser.runtime.sendMessage({ type: 'getDuplicates' });
    const dupSet = new Set(duplicates);
    return allTabs.filter(t => dupSet.has(t.id));
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
  } catch (e) {
    document.getElementById('error').textContent = 'Could not activate tab';
    document.querySelector(`[data-tab="${id}"]`)?.remove();
  }
}

async function getContainerIdentities() {
  if (containerCache) {
    return containerCache;
  }
  const stored = await browser.storage.local.get('containerIdentities');
  if (stored.containerIdentities) {
    containerCache = stored.containerIdentities;
    return containerCache;
  }
  if (!browser.contextualIdentities) {
    containerCache = [];
    return containerCache;
  }
  try {
    containerCache = await browser.contextualIdentities.query({});
    await browser.storage.local.set({ containerIdentities: containerCache });
  } catch (e) {
    console.error('Contextual identities unavailable', e);
    containerCache = [];
  }
  return containerCache;
}

function createTabRow(tab, isDuplicate, activeId, isVisited, item) {
  const div = document.createElement('div');
  div.className = 'tab';
  div.dataset.tab = tab.id;
  div.tabIndex = 0;
  div.draggable = true;
  if (item) div._item = item;
  if (tab.id === activeId) {
    div.classList.add('active');
  }
  if (isDuplicate) {
    div.classList.add('duplicate');
  }
  if (isVisited) {
    div.classList.add('visited');
  } else if (!isVisited && !tab.discarded) {
    div.classList.add('unvisited');
  }


  if (tab.favIconUrl) {
    const icon = document.createElement('img');
    icon.className = 'tab-icon';
    icon.src = tab.favIconUrl;
    icon.alt = '';
    icon.onerror = () => icon.remove();
    div.appendChild(icon);

    let tooltip;
    const showTooltip = () => {
      if (!document.body.classList.contains('full')) return;
      tooltip = document.createElement('div');
      tooltip.className = 'tab-tooltip';
      tooltip.innerHTML = `${tab.title || tab.url}<br>${tab.url}`;
      document.body.appendChild(tooltip);
      const rect = icon.getBoundingClientRect();
      tooltip.style.left = `${rect.right + window.scrollX + 5}px`;
      tooltip.style.top = `${rect.top + window.scrollY}px`;
    };
    const hideTooltip = () => {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    };
    icon.addEventListener('mouseenter', showTooltip);
    icon.addEventListener('mouseleave', hideTooltip);
  }

  const ctx = containerMap.get(tab.cookieStoreId);
  if (ctx) {
    const indicator = document.createElement('span');
    indicator.className = 'container-indicator';
    indicator.style.backgroundColor = ctx.colorCode;
    indicator.title = ctx.name;
    div.appendChild(indicator);
  }


  const title = document.createElement('span');
  title.textContent = tab.title || tab.url;
  title.className = 'tab-title';
  div.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close tab';
  div.appendChild(closeBtn);

  // click and drag events handled via delegation

  return div;
}

function renderTabs(list, activeId, dupIds, visitedIds, winMap, query = '') {
  if (!container) return;
  currentDupIds = dupIds;
  currentActiveId = activeId;
  currentVisited = visitedIds;
  currentWinMap = winMap;
  currentQuery = query;
  tabItems = list.map(entry => ({ tab: entry.tab ?? entry, match: entry.match, selected: false, el: null }));
  idIndexMap = new Map(tabItems.map((it, i) => [it.tab.id, i]));

  container.innerHTML = '';
  if (!tabItems.length) {
    if (virtualList) {
      virtualList.destroy();
      virtualList = null;
    }
    rowHeight = 0;
    const msg = document.createElement('div');
    msg.id = 'empty';
    msg.textContent = 'No tabs to display';
    container.appendChild(msg);
    return;
  }

  if (document.body.classList.contains('full')) {
    if (virtualList) {
      virtualList.destroy();
      virtualList = null;
    }
    if (!rowHeight) {
      const sample = createTabRow(
        tabItems[0].tab,
        dupIds.has(tabItems[0].tab.id),
        activeId,
        visitedIds.has(tabItems[0].tab.id),
        tabItems[0]
      );
      sample.style.position = 'absolute';
      sample.style.visibility = 'hidden';
      container.appendChild(sample);
      rowHeight = sample.getBoundingClientRect().height || 32;
      sample.remove();
    }
    for (const item of tabItems) {
      const el = createTabRow(
        item.tab,
        dupIds.has(item.tab.id),
        activeId,
        visitedIds.has(item.tab.id),
        item
      );
      if (currentQuery && item.match && item.tab.title) {
        const span = el.querySelector('.tab-title');
        if (span) {
          let html = '';
          let last = 0;
          for (const idx of item.match) {
            html += escapeHtml(span.textContent.slice(last, idx));
            html += '<mark>' + escapeHtml(span.textContent[idx]) + '</mark>';
            last = idx + 1;
          }
          html += escapeHtml(span.textContent.slice(last));
          span.innerHTML = html;
        }
      }
      if (item.selected) el.classList.add('selected');
      item.el = el;
      container.appendChild(el);
    }
  } else {
    if (!virtualList) {
      const sample = createTabRow(
        tabItems[0].tab,
        dupIds.has(tabItems[0].tab.id),
        activeId,
        visitedIds.has(tabItems[0].tab.id),
        tabItems[0]
      );
      sample.style.position = 'absolute';
      sample.style.visibility = 'hidden';
      container.appendChild(sample);
      rowHeight = sample.getBoundingClientRect().height || 32;
      sample.remove();
      virtualList = HyperList.create(container, {
        height: container.clientHeight || 400,
        itemHeight: rowHeight,
        total: tabItems.length,
        generate: generateRow
      });
    } else {
      virtualList.refresh(container, {
        height: container.clientHeight || 400,
        itemHeight: rowHeight,
        total: tabItems.length,
        generate: generateRow
      });
    }
  }
}

function generateRow(index) {
  const item = tabItems[index];
  if (!item) return document.createElement('div');
  if (!item.el) {
    item.el = createTabRow(item.tab, currentDupIds.has(item.tab.id), currentActiveId, currentVisited.has(item.tab.id), item);
    if (currentQuery && item.match && item.tab.title) {
      const span = item.el.querySelector('.tab-title');
      if (span) {
        let html = '';
        let last = 0;
        for (const idx of item.match) {
          html += escapeHtml(span.textContent.slice(last, idx));
          html += '<mark>' + escapeHtml(span.textContent[idx]) + '</mark>';
          last = idx + 1;
        }
        html += escapeHtml(span.textContent.slice(last));
        span.innerHTML = html;
      }
    }
    if (item.selected) item.el.classList.add('selected');
  }
  return item.el;
}

function fuzzyMatchPositions(text, query) {
  const pos = [];
  let qi = 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      pos.push(i);
      qi++;
    }
  }
  return qi === q.length ? pos : null;
}

function fuzzyScore(pos) {
  if (!pos) return -Infinity;
  let cont = 1;
  for (let i = 1; i < pos.length; i++) {
    if (pos[i] === pos[i - 1] + 1) cont++;
  }
  return cont * 10 - pos[0];
}

function filterTabs(tabs, query) {
  const results = [];
  for (const tab of tabs) {
    const title = tab.title || '';
    const url = tab.url || '';
    const posTitle = fuzzyMatchPositions(title, query);
    const posUrl = posTitle ? null : fuzzyMatchPositions(url, query);
    if (!posTitle && !posUrl) continue;
    const score = fuzzyScore(posTitle || posUrl);
    results.push({ tab, match: posTitle, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
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
  try {
    const allWins = document.body.classList.contains('full');
    const queryOpts = allWins ? {} : { currentWindow: true };
    let allTabs = await browser.tabs.query(queryOpts);
    if (filterContainerId) {
      allTabs = allTabs.filter(t => t.cookieStoreId === filterContainerId);
    }
    if (allWins) {
      const wins = await browser.windows.getAll({populate: false});
      const order = new Map(wins.map((w, i) => [w.id, i]));
      allTabs.sort((a, b) => {
        const wa = order.get(a.windowId) ?? 0;
        const wb = order.get(b.windowId) ?? 0;
        return wa === wb ? a.index - b.index : wa - wb;
      });
    } else {
      allTabs.sort((a, b) => a.index - b.index);
    }
    document.getElementById('total-count').textContent = allTabs.length;
    const activeCount = allTabs.filter(t => !t.discarded).length;
    document.getElementById('active-count').textContent = activeCount;
    let tabs = await getTabs(allTabs);
    const winMap = allWins ? new Map((await browser.windows.getAll({populate: false})).map((w, i) => [w.id, i + 1])) : null;
    const { duplicates = [] } = await browser.runtime.sendMessage({ type: 'getDuplicates' });
    const dupIds = new Set(duplicates);
    const activeId = allTabs.find(t => t.active)?.id ?? -1;
    const searchInput = document.getElementById('search');
    const query = searchInput.value.trim();
    let list;
    if (query) {
      list = filterTabs(tabs, query);
    } else {
      list = tabs.map(t => ({ tab: t }));
    }
    renderTabs(list, activeId, dupIds, visitedIds, winMap, query);
  } catch (e) {
    console.error('Update failed', e);
    document.getElementById('error').textContent =
      'Error updating tabs: ' + (e.message || e);
  }
}

const scheduleUpdate = debounce(update, 200);

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'visitedUpdated') {
    visitedIds = new Set(msg.visited || []);
    scheduleUpdate();
  }
});

document.getElementById('search').addEventListener('input', scheduleUpdate);
document.getElementById('btn-all').addEventListener('click', () => { view = 'all'; scheduleUpdate(); });

document.addEventListener('keydown', (e) => {
  if (!tabItems.length) return;
  if (document.activeElement.tagName === 'INPUT') return;
  const focused = document.activeElement;
  const isTab = focused.classList.contains('tab');
  let idx = isTab ? idIndexMap.get(parseInt(focused.dataset.tab, 10)) : -1;

  const moveFocus = (delta) => {
    const newIdx = Math.min(Math.max(idx + delta, 0), tabItems.length - 1);
    idx = newIdx;
    container.scrollTop = newIdx * rowHeight;
    requestAnimationFrame(() => { tabItems[newIdx].el?.focus(); });
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
      for (let i = 0; i < tabItems.length; i++) {
        const sel = i >= start && i <= end;
        tabItems[i].selected = sel;
        if (tabItems[i].el) updateSelection(tabItems[i].el, sel);
      }
    } else if (!e.ctrlKey && !e.metaKey) {
      tabItems.forEach(it => {
        it.selected = false;
        if (it.el) updateSelection(it.el, false);
      });
      tabItems[newIdx].selected = true;
      if (tabItems[newIdx].el) updateSelection(tabItems[newIdx].el, true);
      lastSelectedIndex = newIdx;
    } else {
      lastSelectedIndex = newIdx;
    }
  } else if (e.key === ' ' && isTab) {
    e.preventDefault();
    const item = tabItems[idx];
    const sel = !item.selected;
    item.selected = sel;
    if (item.el) updateSelection(item.el, sel);
    lastSelectedIndex = idx;
  } else if (e.key === 'Enter' && isTab) {
    focused.click();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    tabItems.forEach(it => { it.selected = true; if (it.el) updateSelection(it.el, true); });
    lastSelectedIndex = tabItems.length - 1;
  } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    switch (e.key.toLowerCase()) {
      case 'c':
        bulkClose();
        break;
      case 'r':
        bulkReload();
        break;
      case 'u':
        if (e.shiftKey) {
          bulkUnloadAll();
        } else {
          bulkDiscard();
        }
        break;
      case 'm':
        if (MOVE_ENABLED) bulkMove();
        break;
    }
  }
});

async function init() {
  container = document.getElementById('tabs');
  container.addEventListener('scroll', saveScroll);
  container.addEventListener('click', onContainerClick);
  container.addEventListener('dragstart', onContainerDragStart);
  container.addEventListener('dragover', onContainerDragOver);
  container.addEventListener('drop', onContainerDrop);
  if (document.body.classList.contains('full')) {
    container.addEventListener('wheel', (e) => {
      if (container.scrollWidth > container.clientWidth) {
        e.preventDefault();
        container.scrollLeft += e.deltaY * SCROLL_SPEED;
      }
    }, { passive: false });
    document.addEventListener('wheel', (e) => {
      if (!container || e.target.closest('#tabs')) return;
      e.preventDefault();
      container.scrollTop += e.deltaY * SCROLL_SPEED;
    }, { passive: false });
  }
  document.addEventListener('contextmenu', showContextMenu);
  container.addEventListener('dragend', clearPlaceholder);
  const { visited = [] } = await browser.storage.local.get('visited');
  visitedIds = new Set(visited);
  await loadOptions();
  registerTabEvents();
  const select = document.getElementById('container-filter');
  let containerIdents = [];
  let containersAvailable = !!browser.contextualIdentities;
  if (browser.contextualIdentities) {
    try {
      containerIdents = await getContainerIdentities();
    } catch (e) {
      containersAvailable = false;
      console.error('Contextual identities unavailable', e);
      document.getElementById('error').textContent =
        'Container actions disabled: ' + (e.message || e);
    }
  } else {
    document.getElementById('error').textContent =
      'Container actions disabled: container feature not available';
  }
  if (select) {
    if (browser.contextualIdentities) {
      try {
        const identities = await getContainerIdentities();
        identities.forEach(ci => {
          containerMap.set(ci.cookieStoreId, ci);
          const opt = document.createElement('option');
          opt.value = ci.cookieStoreId;
          opt.textContent = ci.name;
          select.appendChild(opt);
        });
        select.addEventListener('change', () => {
          filterContainerId = select.value;
          scheduleUpdate();
        });
      } catch (e) {
        console.error('Contextual identities unavailable', e);
        document.getElementById('error').textContent =
          'Container actions disabled: ' + (e.message || e);
        select.disabled = true;
        containersAvailable = false;
        document.getElementById('container-target')?.setAttribute('disabled', 'true');
        document.getElementById('bulk-add-container')?.setAttribute('disabled', 'true');
        document.getElementById('bulk-remove-container')?.setAttribute('disabled', 'true');
      }
    } else {
      select.disabled = true;
      document.getElementById('container-target')?.setAttribute('disabled', 'true');
      document.getElementById('bulk-add-container')?.setAttribute('disabled', 'true');
      document.getElementById('bulk-remove-container')?.setAttribute('disabled', 'true');
    }
  }
  targetSelect = document.getElementById('container-target');
  if (targetSelect) {
    if (browser.contextualIdentities) {
      try {
        const identities = await getContainerIdentities();
        identities.forEach(ci => {
          const opt = document.createElement('option');
          opt.value = ci.cookieStoreId;
          opt.textContent = ci.name;
          targetSelect.appendChild(opt);
        });
      } catch (e) {
        console.error('Contextual identities unavailable', e);
        document.getElementById('error').textContent =
          'Container actions disabled: ' + (e.message || e);
        targetSelect.disabled = true;
        containersAvailable = false;
        document.getElementById('container-filter')?.setAttribute('disabled', 'true');
        document.getElementById('bulk-add-container')?.setAttribute('disabled', 'true');
        document.getElementById('bulk-remove-container')?.setAttribute('disabled', 'true');
      }
    } else {
      targetSelect.disabled = true;
      document.getElementById('container-filter')?.setAttribute('disabled', 'true');
      document.getElementById('bulk-add-container')?.setAttribute('disabled', 'true');
      document.getElementById('bulk-remove-container')?.setAttribute('disabled', 'true');
    }
  }
  const bulkCloseBtn = document.getElementById('bulk-close');
  if (bulkCloseBtn) bulkCloseBtn.addEventListener('click', bulkClose);

  const bulkReloadBtn = document.getElementById('bulk-reload');
  if (bulkReloadBtn) bulkReloadBtn.addEventListener('click', bulkReload);

  const bulkDiscardBtn = document.getElementById('bulk-discard');
  if (bulkDiscardBtn) bulkDiscardBtn.addEventListener('click', bulkDiscard);

  const bulkUnloadAllBtn = document.getElementById('bulk-unload-all');
  if (bulkUnloadAllBtn) bulkUnloadAllBtn.addEventListener('click', bulkUnloadAll);

  const addContainerBtn = document.getElementById('bulk-add-container');
  if (addContainerBtn) {
    if (containersAvailable) {
      addContainerBtn.addEventListener('click', () => {
        const id = targetSelect ? targetSelect.value : 'firefox-default';
        bulkAssignToContainer(id);
      });
    } else {
      addContainerBtn.disabled = true;
    }
  }

  const removeContainerBtn = document.getElementById('bulk-remove-container');
  if (removeContainerBtn) {
    if (containersAvailable) {
      removeContainerBtn.addEventListener('click', bulkRemoveFromContainer);
    } else {
      removeContainerBtn.disabled = true;
    }
  }

  const moveBtn = document.getElementById('bulk-move');
  if (MOVE_ENABLED && moveBtn) moveBtn.addEventListener('click', bulkMove);
  else if (moveBtn) moveBtn.style.display = 'none';
  await update();
  restoreScroll();
}

// keep the tab list current while the popup is open
const updateListener = () => scheduleUpdate();
function registerTabEvents() {
  browser.tabs.onCreated.addListener(updateListener);
  browser.tabs.onRemoved.addListener(updateListener);
  browser.tabs.onUpdated.addListener(updateListener);
  browser.tabs.onActivated.addListener(updateListener);
  browser.tabs.onDetached.addListener(updateListener);
  browser.tabs.onAttached.addListener(updateListener);
}

function unregisterTabEvents() {
  browser.tabs.onCreated.removeListener(updateListener);
  browser.tabs.onRemoved.removeListener(updateListener);
  browser.tabs.onUpdated.removeListener(updateListener);
  browser.tabs.onActivated.removeListener(updateListener);
  browser.tabs.onDetached.removeListener(updateListener);
  browser.tabs.onAttached.removeListener(updateListener);
}

function cleanup() {
  unregisterTabEvents();
  resetTabState();
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') {
  init();
}
window.addEventListener('unload', cleanup);

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
    addItem('Add Selected to Container', () => {
      const id = targetSelect ? targetSelect.value : 'firefox-default';
      return bulkAssignToContainer(id);
    });
    addItem('Remove Selected from Container', bulkRemoveFromContainer);
  }

  if (tabEl && (!selected.length || !tabEl.classList.contains('selected'))) {
    const id = parseInt(tabEl.dataset.tab, 10);
    addItem('Activate', () => activateTab(id));
    addItem('Unload', async () => {
      await browser.tabs.discard(id);
      await browser.runtime.sendMessage({ type: 'unmarkVisited', tabId: id });
      scheduleUpdate();
    });
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
    const info = document.createElement('div');
    info.textContent = `KepiTAB v${browser.runtime.getManifest().version}`;
    context.appendChild(info);
  }

  addItem('Unload All Tabs', bulkUnloadAll);
  addItem('Options', () => browser.runtime.openOptionsPage());

  context.style.left = e.pageX + 'px';
  context.style.top = e.pageY + 'px';
  context.classList.remove('hidden');
}

document.addEventListener('click', () => context.classList.add('hidden'));

function getSelectedTabIds() {
  return tabItems.filter(it => it.selected).map(it => it.tab.id);
}

async function bulkClose() {
  const ids = getSelectedTabIds();
  if (ids.length) await browser.tabs.remove(ids);
  scheduleUpdate();
}

async function bulkReload() {
  const ids = getSelectedTabIds();
  await Promise.all(ids.map(id => browser.tabs.reload(id)));
}

async function bulkDiscard() {
  const ids = getSelectedTabIds();
  await Promise.all(ids.map(async id => {
    await browser.tabs.discard(id);
    await browser.runtime.sendMessage({ type: 'unmarkVisited', tabId: id });
  }));
  scheduleUpdate();
}

async function bulkUnloadAll() {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map(async t => {
    await browser.tabs.discard(t.id);
    await browser.runtime.sendMessage({ type: 'unmarkVisited', tabId: t.id });
  }));
  scheduleUpdate();
}

async function bulkMove() {
  const ids = getSelectedTabIds();
  const windows = await browser.windows.getAll({populate: false});
  const currentWinId = ids.length ? (await browser.tabs.get(ids[0])).windowId : null;
  const other = windows.find(w => ids.length && w.id !== currentWinId);
  if (other) {
    const tabs = await Promise.all(ids.map(id => browser.tabs.get(id)));
    tabs.sort((a, b) => a.index - b.index);
    for (const tab of tabs) {
      await browser.tabs.move(tab.id, { windowId: other.id, index: -1 });
    }
  }
  scheduleUpdate();
}

async function bulkAssignToContainer(containerId) {
  const ids = getSelectedTabIds();
  if (!ids.length) return;
  if (ids.length > 10 && !confirm(`Move ${ids.length} tabs to the selected container?`)) return;
  let tabs = await Promise.all(ids.map(id => browser.tabs.get(id)));
  tabs.sort((a, b) => a.windowId === b.windowId ? a.index - b.index : a.windowId - b.windowId);
  const offsets = new Map();
  for (const tab of tabs) {
    const off = offsets.get(tab.windowId) || 0;
    await browser.tabs.create({
      url: tab.url,
      cookieStoreId: containerId,
      index: tab.index + off,
      windowId: tab.windowId,
      pinned: tab.pinned,
      active: tab.active
    });
    offsets.set(tab.windowId, off + 1);
  }
  await browser.tabs.remove(ids);
  scheduleUpdate();
}

async function bulkRemoveFromContainer() {
  await bulkAssignToContainer('firefox-default');
}

function onContainerClick(e) {
  const tabEl = e.target.closest('.tab');
  if (!tabEl || !container.contains(tabEl)) return;
  if (e.target.classList.contains('close-btn')) {
    e.stopPropagation();
    const id = parseInt(tabEl.dataset.tab, 10);
    browser.tabs.remove(id).then(scheduleUpdate);
    return;
  }
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const idx = tabs.indexOf(tabEl);
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    e.preventDefault();
    if (e.shiftKey && lastSelectedIndex !== -1) {
      const start = Math.min(lastSelectedIndex, idx);
      const end = Math.max(lastSelectedIndex, idx);
      const select = !tabEl.classList.contains('selected');
      for (let i = start; i <= end; i++) {
        updateSelection(tabs[i], select);
      }
    } else {
      updateSelection(tabEl, !tabEl.classList.contains('selected'));
    }
    lastSelectedIndex = idx;
    return;
  }
  activateTab(parseInt(tabEl.dataset.tab, 10));
}

function onContainerDragStart(e) {
  const tabEl = e.target.closest('.tab');
  if (!tabEl) return;
  const selected = getSelectedTabIds();
  if (selected.length > 1 && tabEl.classList.contains('selected')) {
    e.dataTransfer.setData('text/plain', selected.join(','));
  } else {
    e.dataTransfer.setData('text/plain', tabEl.dataset.tab);
  }
  clearPlaceholder();
}

function onContainerDragOver(e) {
  const tabEl = e.target.closest('.tab');
  if (!tabEl) return;
  e.preventDefault();
  const rect = tabEl.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  showPlaceholder(tabEl, before);
}

async function onContainerDrop(e) {
  const tabEl = e.target.closest('.tab');
  if (!tabEl) return;
  e.preventDefault();
  clearPlaceholder();
  const data = e.dataTransfer.getData('text/plain');
  const ids = data.split(',').map(id => parseInt(id, 10)).filter(n => !isNaN(n));
  const toId = parseInt(tabEl.dataset.tab, 10);
  if (!ids.length) return;
  const toTab = await browser.tabs.get(toId);
  const rect = tabEl.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  let index = before ? toTab.index : toTab.index + 1;
  for (const id of ids) {
    if (id === toId) continue;
    const fromTab = await browser.tabs.get(id);
    let idx = index;
    if (fromTab.windowId === toTab.windowId && fromTab.index < index) {
      idx--;
    }
    if (idx < 0) idx = 0;
    await browser.tabs.move(id, { windowId: toTab.windowId, index: idx });
    if (fromTab.windowId !== toTab.windowId || fromTab.index >= index) {
      index++;
    }
  }
  scheduleUpdate();
}

