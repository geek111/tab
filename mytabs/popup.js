// Shared script used by popup.html and sidebar.html
let view = 'all';
let restored = false;
// Feature toggles loaded from storage
let SHOW_RECENT = true;
let SHOW_DUPLICATES = true;
let MOVE_ENABLED = true;
let SCROLL_SPEED = 1;

let lastSelectedIndex = -1;
let container; // tab list element
let scrollContainer; // scrolling element (wrapper in full view)
let dropTarget = null;
let containerMap = new Map();
let filterContainerId = '';
let containerCache;
let targetSelect;
let groupTargetSelect;
let visitedIds = new Set();
let movePending = null;
let groups = [];
let tabGroupMap = new Map();
let filterGroupId = '';

let virtualList = null;
let tabItems = [];
let idIndexMap = new Map();
let rowHeight = 0;
let currentDupIds = new Set();
let currentActiveId = -1;
let currentVisited = new Set();
let currentWinMap = null;
let currentQuery = '';

function adjustGridWidth() {
  if (!document.body.classList.contains('full')) return;
  const wrapper = document.getElementById('tabs-wrapper');
  const grid = document.getElementById('tabs');
  if (!wrapper || !grid || !grid.lastElementChild) return;
  const last = grid.lastElementChild;
  const width = Math.max(wrapper.clientWidth, last.offsetLeft + last.offsetWidth);
  grid.style.width = width + 'px';
}

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
  movePending = null;
}
function clearPlaceholder() {
  if (dropTarget) {
    dropTarget.classList.remove('drop-before', 'drop-after');
    dropTarget = null;
  }
}

function hideAllTooltips() {
  document.querySelectorAll('.tab-tooltip').forEach(t => t.remove());
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

function truncateText(str, maxLen = 80) {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
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

async function loadGroups() {
  const { groups: gs = [], tabGroups = {} } = await browser.runtime.sendMessage({ type: 'getGroups' });
  groups = gs;
  tabGroupMap = new Map(Object.entries(tabGroups).map(([k, v]) => [parseInt(k, 10), v]));
  const sel = document.getElementById('group-filter');
  const targetSel = document.getElementById('group-target');
  if (sel) {
    const prev = sel.value;
    sel.innerHTML = '<option value="">All Groups</option><option value="none">No Group</option>';
    for (const g of groups) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      sel.appendChild(opt);
    }
    sel.value = prev;
    if (prev && !groups.some(g => String(g.id) === prev)) {
      filterGroupId = '';
      sel.value = '';
      scheduleUpdate();
    }
  }
  if (targetSel) {
    const current = targetSel.value;
    targetSel.textContent = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'No Group';
    targetSel.appendChild(noneOpt);
    for (const g of groups) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      targetSel.appendChild(opt);
    }
    targetSel.value = groups.some(g => String(g.id) === current) ? current : '';
  }
}

function updateSelection(row, selected) {
  if (!row.classList.contains('tab')) return;
  row.classList.toggle('selected', selected);
  if (row._item) {
    row._item.selected = selected;
  }
}

function clearSelection() {
  for (const item of tabItems) {
    if (item.separator) continue;
    item.selected = false;
    if (item.el) updateSelection(item.el, false);
  }
  lastSelectedIndex = -1;
}

const saveScroll = debounce(() => {
  if (!scrollContainer) return;
  if (document.body.classList.contains('full')) {
    browser.storage.local.set({ scrollLeftFull: scrollContainer.scrollLeft });
  } else {
    browser.storage.local.set({ scrollTop: scrollContainer.scrollTop });
  }
}, 200);

async function restoreScroll() {
  if (restored) return;
  if (document.body.classList.contains('full')) {
    const { scrollLeftFull = 0 } = await browser.storage.local.get('scrollLeftFull');
    if (scrollContainer) {
      scrollContainer.scrollLeft = scrollLeftFull;
    }
  } else {
    const { scrollTop = 0 } = await browser.storage.local.get('scrollTop');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollTop;
    }
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
    return allTabs.filter(t => currentDupIds.has(t.id));
  }
  return allTabs;
}

function closeUI() {
  if (browser.sidebarAction) {
    try { browser.sidebarAction.close(); } catch (e) {}
  }
  window.close();
}

async function activateTab(id, winId) {
  try {
    await browser.tabs.update(id, {active: true});
    if (winId) {
      await browser.windows.update(winId, {focused: true});
    }
  } catch (e) {
    document.getElementById('error').textContent = 'Could not activate tab';
    document.querySelector(`[data-tab="${id}"]`)?.remove();
  }
}

async function getContainerIdentities() {
  if (!browser.contextualIdentities) {
    containerCache = [];
    return containerCache;
  }
  try {
    containerCache = await browser.contextualIdentities.query({});
    await browser.storage.local.set({ containerIdentities: containerCache });
  } catch (e) {
    console.error('Contextual identities unavailable', e);
    if (!containerCache) {
      const stored = await browser.storage.local.get('containerIdentities');
      containerCache = stored.containerIdentities || [];
    }
  }
  return containerCache;
}

function refreshContainerDropdowns(identities) {
  const filter = document.getElementById('container-filter');
  const target = document.getElementById('container-target');
  containerMap.clear();
  identities.forEach(ci => containerMap.set(ci.cookieStoreId, ci));
  if (filter) {
    const current = filter.value;
    filter.textContent = '';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'All Containers';
    filter.appendChild(optAll);
    identities.forEach(ci => {
      const opt = document.createElement('option');
      opt.value = ci.cookieStoreId;
      opt.textContent = ci.name;
      filter.appendChild(opt);
    });
    filter.value = containerMap.has(current) ? current : '';
  }
  if (target) {
    const currentT = target.value;
    target.textContent = '';
    identities.forEach(ci => {
      const opt = document.createElement('option');
      opt.value = ci.cookieStoreId;
      opt.textContent = ci.name;
      target.appendChild(opt);
    });
    target.value = containerMap.has(currentT) ? currentT : (identities[0]?.cookieStoreId || 'firefox-default');
  }
}

function createTabRow(tab, isDuplicate, activeId, isVisited, item) {
  const row = document.createElement('div');
  const isFull = document.body.classList.contains('full');
  row.className = 'tab';
  row.dataset.tab = tab.id;
  row.dataset.windowId = tab.windowId;
  row.tabIndex = 0;
  row.draggable = true;
  row.setAttribute('draggable', 'true');
  if (item) row._item = item;
  if (tab.id === activeId) {
    row.classList.add('active');
  }
  if (isDuplicate) {
    row.classList.add('duplicate');
  }
  if (isVisited) {
    row.classList.add('visited');
  } else if (!isVisited && !tab.discarded) {
    row.classList.add('unvisited');
  }


  const iconCell = document.createElement('div');
  if (tab.favIconUrl) {
    const icon = document.createElement('img');
    icon.className = 'tab-icon';
    icon.src = tab.favIconUrl;
    icon.alt = '';
    icon.onerror = () => icon.remove();
    iconCell.appendChild(icon);
  
    let tooltip;
    const showTooltip = () => {
      // Allow tooltips in both popup and full views
      hideAllTooltips();
      tooltip = document.createElement('div');
      tooltip.className = 'tab-tooltip';
      const truncatedTitle = truncateText(tab.title || tab.url);
      const truncatedUrl = truncateText(tab.url);
      const safeTitle = escapeHtml(truncatedTitle);
      const safeUrl = escapeHtml(truncatedUrl);
      const ctx = containerMap.get(tab.cookieStoreId);
      let tooltipHtml = `${safeTitle}<br>${safeUrl}`;
      if (ctx) {
        const safeCtx = escapeHtml(ctx.name);
        tooltipHtml += `<br>${safeCtx}`;
      }
      tooltip.innerHTML = tooltipHtml;
      document.body.appendChild(tooltip);
      const rect = icon.getBoundingClientRect();
      let left = rect.right + window.scrollX + 5;
      const top = rect.top + window.scrollY;
      const width = tooltip.offsetWidth;
      if (left + width > window.innerWidth - 5) {
        left = rect.left + window.scrollX - width - 5;
        tooltip.classList.add('left');
      } else {
        tooltip.classList.remove('left');
      }
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      requestAnimationFrame(() => {
        tooltip.classList.add('visible');
      });
    };
    const hideTooltip = () => {
      if (tooltip) {
        tooltip.classList.remove('visible');
        const el = tooltip;
        tooltip = null;
        setTimeout(() => {
          el.classList.remove('left');
          el.remove();
        }, 150);
      }
    };
    icon.addEventListener('mouseenter', showTooltip);
    icon.addEventListener('mouseleave', hideTooltip);
  }
  row.appendChild(iconCell);

  const indicatorCell = document.createElement('div');
  const ctx = containerMap.get(tab.cookieStoreId);
  if (ctx) {
    const indicator = document.createElement('span');
    indicator.className = 'container-indicator';
    indicator.style.backgroundColor = ctx.colorCode;
    indicator.title = ctx.name;
    indicatorCell.appendChild(indicator);
  }
  row.appendChild(indicatorCell);


  const titleCell = document.createElement('div');
  const title = document.createElement('span');
  title.textContent = tab.title || tab.url;
  title.className = 'tab-title';
  titleCell.appendChild(title);
  row.appendChild(titleCell);

  const closeCell = document.createElement('div');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close tab';
  closeCell.appendChild(closeBtn);
  row.appendChild(closeCell);

  // ensure dragging works from any cell in popup mode
  row.querySelectorAll('*').forEach(el => {
    el.draggable = true;
    el.setAttribute('draggable', 'true');
  });

  // click and drag events handled via delegation

  return row;
}

function createWindowSeparator(label) {
  const div = document.createElement('div');
  div.className = 'window-separator';
  div.textContent = label.toUpperCase();
  div.tabIndex = -1;
  return div;
}

function createGroupSeparator(label) {
  const div = document.createElement('div');
  div.className = 'group-separator';
  div.textContent = label.toUpperCase();
  div.tabIndex = -1;
  return div;
}

function renderTabs(list, activeId, dupIds, visitedIds, winMap, query = '') {
  if (!container) return;
  currentDupIds = dupIds;
  currentActiveId = activeId;
  currentVisited = visitedIds;
  currentWinMap = winMap;
  currentQuery = query;
  const full = document.body.classList.contains('full') && winMap;
  tabItems = [];
  idIndexMap = new Map();
  let lastWin = -1;
  let lastGroup = undefined;
  const groupNames = new Map(groups.map(g => [g.id, g.name]));
  for (const entry of list) {
    const tab = entry.tab ?? entry;
    const gId = tabGroupMap.get(tab.id) || null;
    if (!filterGroupId && groups.length && gId !== lastGroup) {
      const label = gId ? groupNames.get(gId) || 'GROUP' : 'NO GROUP';
      tabItems.push({ separator: true, label, el: null, group: true });
      lastGroup = gId;
      lastWin = -1;
    }
    if (full && tab.windowId !== lastWin) {
      tabItems.push({ separator: true, label: `Window ${winMap.get(tab.windowId)}`, el: null });
      lastWin = tab.windowId;
    }
    const item = { tab, match: entry.match, selected: false, el: null };
    tabItems.push(item);
    idIndexMap.set(tab.id, tabItems.length - 1);
  }

  container.innerHTML = '';
  if (virtualList) {
    virtualList.destroy();
    virtualList = null;
  }
  if (!tabItems.length) {
    rowHeight = 0;
    const msg = document.createElement('div');
    msg.id = 'empty';
    msg.textContent = 'No tabs to display';
    container.appendChild(msg);
    adjustGridWidth();
    return;
  }

  if (document.body.classList.contains('full')) {
    if (!rowHeight) {
      const sampleItem = tabItems.find(it => !it.separator);
      if (sampleItem) {
        const sample = createTabRow(
          sampleItem.tab,
          dupIds.has(sampleItem.tab.id),
          activeId,
          visitedIds.has(sampleItem.tab.id),
          sampleItem
        );
        sample.style.position = 'absolute';
        sample.style.visibility = 'hidden';
        container.appendChild(sample);
        rowHeight = sample.getBoundingClientRect().height || 32;
        document.documentElement.style.setProperty('--tile-height', rowHeight + 'px');
        sample.remove();
      }
    }
    for (const item of tabItems) {
      let el;
      if (item.separator) {
        el = item.group ? createGroupSeparator(item.label) : createWindowSeparator(item.label);
      } else {
        el = createTabRow(
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
      }
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
      document.documentElement.style.setProperty('--tile-height', rowHeight + 'px');
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
  adjustGridWidth();
}

function generateRow(index) {
  const item = tabItems[index];
  if (!item) return document.createElement('div');
  if (!item.el) {
    if (item.separator) {
      item.el = item.group ? createGroupSeparator(item.label) : createWindowSeparator(item.label);
    } else {
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
  hideAllTooltips();
  const isFull = document.body.classList.contains('full');
  const prevScroll = scrollContainer
    ? isFull
      ? scrollContainer.scrollLeft
      : scrollContainer.scrollTop
    : 0;
  try {
    await loadGroups();
    const allWins = document.body.classList.contains('full');
    const queryOpts = allWins ? {} : { currentWindow: true };
    let allTabs = await browser.tabs.query(queryOpts);
    if (filterContainerId) {
      allTabs = allTabs.filter(t => t.cookieStoreId === filterContainerId);
    }
    if (filterGroupId === 'none') {
      allTabs = allTabs.filter(t => !tabGroupMap.get(t.id));
    } else if (filterGroupId) {
      allTabs = allTabs.filter(t => String(tabGroupMap.get(t.id)) === filterGroupId);
    }
    const groupOrder = new Map(groups.map((g, i) => [g.id, i]));
    if (allWins) {
      const wins = await browser.windows.getAll({populate: false});
      const order = new Map(wins.map((w, i) => [w.id, i]));
      allTabs.sort((a, b) => {
        const ga = groupOrder.get(tabGroupMap.get(a.id)) ?? groups.length;
        const gb = groupOrder.get(tabGroupMap.get(b.id)) ?? groups.length;
        if (ga !== gb) return ga - gb;
        const wa = order.get(a.windowId) ?? 0;
        const wb = order.get(b.windowId) ?? 0;
        return wa === wb ? a.index - b.index : wa - wb;
      });
    } else {
      allTabs.sort((a, b) => {
        const ga = groupOrder.get(tabGroupMap.get(a.id)) ?? groups.length;
        const gb = groupOrder.get(tabGroupMap.get(b.id)) ?? groups.length;
        return ga === gb ? a.index - b.index : ga - gb;
      });
    }
    document.getElementById('total-count').textContent = allTabs.length;
    const activeCount = allTabs.filter(t => !t.discarded).length;
    document.getElementById('active-count').textContent = activeCount;
    let tabs = await getTabs(allTabs);
    const winMap = allWins ? new Map((await browser.windows.getAll({populate: false})).map((w, i) => [w.id, i + 1])) : null;
    const dupIds = currentDupIds;
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
  if (scrollContainer) {
    if (isFull) {
      scrollContainer.scrollLeft = prevScroll;
    } else {
      scrollContainer.scrollTop = prevScroll;
    }
  }
}

const scheduleUpdate = debounce(update, 200);

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'visitedUpdated') {
    visitedIds = new Set(msg.visited || []);
    scheduleUpdate();
  } else if (msg && msg.type === 'duplicatesUpdated') {
    currentDupIds = new Set(msg.duplicates || []);
    scheduleUpdate();
  }
});

const searchBox = document.getElementById('search');
const clearBtn = document.getElementById('search-clear');
const measureCtx = document.createElement('canvas').getContext('2d');

function updateClearButton() {
  if (!clearBtn) return;
  const style = window.getComputedStyle(searchBox);
  measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const textWidth = measureCtx.measureText(searchBox.value).width;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  const maxLeft = searchBox.offsetWidth - clearBtn.offsetWidth - paddingRight;
  const left = Math.min(paddingLeft + textWidth + 4, maxLeft);
  clearBtn.style.left = `${left}px`;
  clearBtn.classList.toggle('hidden', !searchBox.value);
}

searchBox.addEventListener('input', () => {
  updateClearButton();
  scheduleUpdate();
});

window.addEventListener('resize', updateClearButton);

clearBtn?.addEventListener('click', () => {
  if (searchBox.value) {
    searchBox.value = '';
    updateClearButton();
    scheduleUpdate();
  }
});

updateClearButton();
document.getElementById('btn-all').addEventListener('click', () => { view = 'all'; scheduleUpdate(); });

document.addEventListener('keydown', (e) => {
  if (!searchBox) return;
  if (e.key === 'Escape') {
    if (searchBox.value) {
      searchBox.value = '';
      scheduleUpdate();
    }
    return;
  }
  if (document.activeElement.tagName !== 'INPUT' &&
      e.key.length === 1 &&
      !e.ctrlKey && !e.metaKey && !e.altKey) {
    searchBox.focus();
    searchBox.value += e.key;
    scheduleUpdate();
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener('keydown', (e) => {
  if (!tabItems.length) return;
  if (document.activeElement.tagName === 'INPUT') return;
  const focused = document.activeElement;
  const isTab = focused.classList.contains('tab');
  let idx = isTab ? idIndexMap.get(parseInt(focused.dataset.tab, 10)) : -1;

  const moveFocus = (delta) => {
    let newIdx = idx;
    do {
      newIdx = Math.min(Math.max(newIdx + delta, 0), tabItems.length - 1);
    } while (tabItems[newIdx] && tabItems[newIdx].separator);
    idx = newIdx;
    const el = tabItems[newIdx].el;
    requestAnimationFrame(() => {
      el?.focus();
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return newIdx;
  };

  if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault();
    clearSelection();
    return;
  }

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const oldIdx = idx;
    const newIdx = moveFocus(e.key === 'ArrowDown' ? 1 : -1);
    if (e.shiftKey && isTab) {
      if (lastSelectedIndex === -1) lastSelectedIndex = oldIdx;
      const start = Math.min(lastSelectedIndex, newIdx);
      const end = Math.max(lastSelectedIndex, newIdx);
      for (let i = 0; i < tabItems.length; i++) {
        if (tabItems[i].separator) continue;
        const sel = i >= start && i <= end;
        tabItems[i].selected = sel;
        if (tabItems[i].el) updateSelection(tabItems[i].el, sel);
      }
    } else if (!e.ctrlKey && !e.metaKey) {
      tabItems.forEach(it => {
        if (it.separator) return;
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
    let last = -1;
    tabItems.forEach((it, i) => {
      if (it.separator) return;
      it.selected = true;
      if (it.el) updateSelection(it.el, true);
      last = i;
    });
    lastSelectedIndex = last;
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
  container = document.getElementById('tabs-body') ||
              document.getElementById('tabs');
  scrollContainer = document.body.classList.contains('full')
    ? document.getElementById('tabs-wrapper')
    : container;
  scrollContainer.addEventListener('scroll', saveScroll);
  scrollContainer.addEventListener('scroll', hideAllTooltips);
  container.addEventListener('click', onContainerClick);
  container.addEventListener('dragstart', onContainerDragStart);
  container.addEventListener('dragover', onContainerDragOver);
  container.addEventListener('drop', onContainerDrop);
  if (document.body.classList.contains('full')) {
    scrollContainer.addEventListener('wheel', (e) => {
      if (scrollContainer.scrollWidth > scrollContainer.clientWidth) {
        e.preventDefault();
        const delta = e.deltaX || e.deltaY;
        scrollContainer.scrollLeft += delta * SCROLL_SPEED;
      }
    }, { passive: false });
    document.addEventListener('wheel', (e) => {
      if (!scrollContainer || e.target.closest('#tabs-wrapper')) return;
      e.preventDefault();
      const delta = e.deltaX || e.deltaY;
      scrollContainer.scrollLeft += delta * SCROLL_SPEED;
    }, { passive: false });
  }
  document.addEventListener('contextmenu', showContextMenu);
  container.addEventListener('dragend', clearPlaceholder);
  const { visited = [] } = await browser.storage.local.get('visited');
  visitedIds = new Set(visited);
  const { duplicates = [] } = await browser.runtime.sendMessage({ type: 'getDuplicates' });
  currentDupIds = new Set(duplicates);
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
  targetSelect = document.getElementById('container-target');
  if (select || targetSelect) {
    if (containersAvailable) {
      try {
        refreshContainerDropdowns(containerIdents);
        if (select) {
          select.addEventListener('change', () => {
            filterContainerId = select.value;
            scheduleUpdate();
          });
        }
      } catch (e) {
        console.error('Contextual identities unavailable', e);
        document.getElementById('error').textContent =
          'Container actions disabled: ' + (e.message || e);
        if (select) select.disabled = true;
        if (targetSelect) targetSelect.disabled = true;
        containersAvailable = false;
        document.getElementById('container-filter')?.setAttribute('disabled', 'true');
        document.getElementById('container-target')?.setAttribute('disabled', 'true');
        document.getElementById('bulk-add-container')?.setAttribute('disabled', 'true');
        document.getElementById('bulk-remove-container')?.setAttribute('disabled', 'true');
      }
    } else {
      if (select) select.disabled = true;
      if (targetSelect) targetSelect.disabled = true;
      document.getElementById('container-filter')?.setAttribute('disabled', 'true');
      document.getElementById('container-target')?.setAttribute('disabled', 'true');
      document.getElementById('bulk-add-container')?.setAttribute('disabled', 'true');
      document.getElementById('bulk-remove-container')?.setAttribute('disabled', 'true');
    }
  }
  await loadGroups();
  const groupSel = document.getElementById('group-filter');
  if (groupSel) {
    groupSel.addEventListener('change', () => {
      filterGroupId = groupSel.value;
      scheduleUpdate();
    });
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

  groupTargetSelect = document.getElementById('group-target');
  const addGroupBtn = document.getElementById('bulk-add-group');
  if (addGroupBtn) {
    addGroupBtn.addEventListener('click', () => {
      const gid = groupTargetSelect ? groupTargetSelect.value : '';
      assignSelectedToGroup(gid ? parseInt(gid, 10) : null);
    });
  }
  const removeGroupBtn = document.getElementById('bulk-remove-group');
  if (removeGroupBtn) {
    removeGroupBtn.addEventListener('click', () => assignSelectedToGroup(null));
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

// recompute item height when theme or scaling changes
window.addEventListener('theme-applied', () => {
  rowHeight = 0;
  scheduleUpdate();
});

window.addEventListener('resize', () => {
  if (document.body.classList.contains('full')) {
    requestAnimationFrame(adjustGridWidth);
  }
});

// custom context menu
const context = document.getElementById('context');
async function movePendingTo(targetEl, evt) {
  const ids = movePending;
  if (!ids || !ids.length) return;
  const toId = parseInt(targetEl.dataset.tab, 10);
  const toTab = await browser.tabs.get(toId);
  const rect = targetEl.getBoundingClientRect();
  const before = evt.clientY < rect.top + rect.height / 2;
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
  if (view === 'recent') {
    await browser.runtime.sendMessage({
      type: 'reorderRecent',
      ids,
      toId,
      before
    }).catch(() => {});
  }
  movePending = null;
  tabItems.forEach(it => it.el?.classList.remove('move-pending'));
  scheduleUpdate();
}

function flagTabsForMove() {
  movePending = getSelectedTabIds().slice();
  tabItems.forEach(it => {
    if (!it.separator && it.selected && it.el) {
      it.el.classList.add('move-pending');
    }
  });
}

function clearMovePending() {
  movePending = null;
  tabItems.forEach(it => it.el?.classList.remove('move-pending'));
}


function showContextMenu(e) {
  e.preventDefault();
  hideAllTooltips();
  const tabEl = e.target.closest('.tab');
  context.innerHTML = '';

  const selected = getSelectedTabIds();
  const addItem = (label, fn, parent = context) => {
    const item = document.createElement('div');
    item.textContent = label;
    item.addEventListener('click', async () => {
      context.classList.add('hidden');
      await fn();
    });
    parent.appendChild(item);
  };

  const addSubMenu = (label, build) => {
    const item = document.createElement('div');
    item.textContent = label + ' \u25B6';
    item.classList.add('submenu-parent');
    const menu = document.createElement('div');
    menu.className = 'submenu hidden';
    item.appendChild(menu);
    item.addEventListener('mouseenter', () => menu.classList.remove('hidden'));
    item.addEventListener('mouseleave', () => menu.classList.add('hidden'));
    context.appendChild(item);
    build(menu);
  };

  if (selected.length) {
    addItem('Close Selected', bulkClose);
    addItem('Reload Selected', bulkReload);
    addItem('Unload Selected', bulkDiscard);
    if (MOVE_ENABLED) {
      if (!movePending) addItem('Flag for Move', flagTabsForMove);
      else addItem('Clear Move Flag', clearMovePending);
    }
    addItem('Add Selected to Container', () => {
      const id = targetSelect ? targetSelect.value : 'firefox-default';
      return bulkAssignToContainer(id);
    });
    addItem('Remove Selected from Container', bulkRemoveFromContainer);
  }

  if (MOVE_ENABLED && movePending && tabEl) {
    addItem('Move Flagged Tabs Here', () => movePendingTo(tabEl, e));
  }

  if (tabEl && (!selected.length || !tabEl.classList.contains('selected'))) {
    const id = parseInt(tabEl.dataset.tab, 10);
    const win = parseInt(tabEl.dataset.windowId, 10);
    // Place Close as the first entry for single-tab actions
    addItem('Close', async () => {
      await browser.tabs.remove(id);
      scheduleUpdate();
    });
    addItem('Activate', () => activateTab(id, win));
    addItem('Unload', async () => {
      await browser.tabs.discard(id);
      await browser.runtime.sendMessage({ type: 'unmarkVisited', tabId: id });
      scheduleUpdate();
    });
    // Direct move option removed in favor of flagged move workflow
  }

  if (!tabEl && !selected.length) {
    const info = document.createElement('div');
    info.textContent = `KepiTAB v${browser.runtime.getManifest().version}`;
    context.appendChild(info);
  }

  const clickedId = tabEl ? parseInt(tabEl.dataset.tab, 10) : null;
  const idsForGroup = selected.length ? selected.slice() : (clickedId ? [clickedId] : []);
  if (idsForGroup.length) {
    addSubMenu('Group', menu => {
      addItem('Remove from Group', () => assignSelectedToGroup(null, idsForGroup.slice()), menu);
      for (const g of groups) {
        addItem(`Assign to ${g.name}`, () => assignSelectedToGroup(g.id, idsForGroup.slice()), menu);
      }
      addItem('Create Group', createGroupPrompt, menu);
    });
  }

  addItem('Unload All Tabs', bulkUnloadAll);
  addItem('Options', () => browser.runtime.openOptionsPage());

  context.style.left = e.pageX + 'px';
  context.style.top = e.pageY + 'px';
  context.classList.remove('hidden');
}

document.addEventListener('click', () => context.classList.add('hidden'));

function getSelectedTabIds() {
  return tabItems.filter(it => !it.separator && it.selected).map(it => it.tab.id);
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
  const errorEl = document.getElementById('error');
  if (errorEl) errorEl.textContent = '';
  let identities = [];
  if (browser.contextualIdentities) {
    try {
      identities = await getContainerIdentities();
      refreshContainerDropdowns(identities);
      if (containerId !== 'firefox-default') {
        const exists = identities.some(ci => ci.cookieStoreId === containerId);
        if (!exists) {
          if (errorEl) errorEl.textContent = 'Selected container does not exist';
          return;
        }
      }
    } catch (e) {
      console.error('Contextual identities unavailable', e);
      if (errorEl) {
        errorEl.textContent = 'Container actions disabled: ' + (e.message || e);
      }
      return;
    }
  }
  const ids = getSelectedTabIds();
  if (!ids.length) return;
  if (ids.length > 10 && !confirm(`Move ${ids.length} tabs to the selected container?`)) return;
  let tabs = await Promise.all(ids.map(id => browser.tabs.get(id)));
  tabs.sort((a, b) => a.windowId === b.windowId ? a.index - b.index : a.windowId - b.windowId);
  const failed = [];
  for (const tab of tabs) {
    try {
      if (/^(about:|moz-extension:|chrome:|file:|view-source:)/.test(tab.url)) {
        failed.push(tab.title || tab.url);
        continue;
      }
      const newTab = await browser.tabs.create({
        url: tab.url,
        cookieStoreId: containerId,
        index: tab.index,
        windowId: tab.windowId,
        pinned: tab.pinned,
        active: tab.active
      });
      try {
        await browser.tabs.remove(tab.id);
      } catch (e) {
        console.error('Failed to remove tab', e);
        failed.push(tab.title || tab.url);
        if (newTab && newTab.id) {
          await browser.tabs.remove(newTab.id);
        }
      }
    } catch (e) {
      console.error('Failed to move tab', e);
      failed.push(tab.title || tab.url);
    }
  }
  scheduleUpdate();
  if (failed.length) {
    if (errorEl) errorEl.textContent = `Some tabs could not be moved: ${failed.join(', ')}`;
  }
}

async function bulkRemoveFromContainer() {
  await bulkAssignToContainer('firefox-default');
}

async function assignSelectedToGroup(groupId, ids = null) {
  if (!ids) ids = getSelectedTabIds();
  if (!ids.length) return;
  await browser.runtime.sendMessage({ type: 'assignGroups', groupId, ids });
  await loadGroups();
  scheduleUpdate();
}

async function createGroupPrompt() {
  const name = prompt('Group name:');
  if (!name) return;
  await browser.runtime.sendMessage({ type: 'createGroup', name });
  await loadGroups();
  scheduleUpdate();
}

function onContainerClick(e) {
  hideAllTooltips();
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
  activateTab(
    parseInt(tabEl.dataset.tab, 10),
    parseInt(tabEl.dataset.windowId, 10)
  );
}

function onContainerDragStart(e) {
  hideAllTooltips();
  const tabEl = e.target.closest('.tab');
  if (!tabEl) return;
  const selected = getSelectedTabIds();
  if (selected.length > 1 && tabEl.classList.contains('selected')) {
    e.dataTransfer.setData('text/plain', selected.join(','));
  } else {
    e.dataTransfer.setData('text/plain', tabEl.dataset.tab);
  }
  e.dataTransfer.effectAllowed = 'move';
  clearPlaceholder();
}

function onContainerDragOver(e) {
  hideAllTooltips();
  const tabEl = e.target.closest('.tab');
  if (!tabEl) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const rect = tabEl.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  showPlaceholder(tabEl, before);
}

async function onContainerDrop(e) {
  hideAllTooltips();
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
  if (view === 'recent') {
    await browser.runtime.sendMessage({
      type: 'reorderRecent',
      ids,
      toId,
      before
    }).catch(() => {});
  }
  scheduleUpdate();
}

