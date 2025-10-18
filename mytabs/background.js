// No cap on stored tabs so the Recent panel lists every visited tab
const MAX_RECENT = Infinity;
const action = browser.browserAction || browser.action;

let recent = [];
let visited = new Set();
let recentTimer = null;
let autoUnload = false;
let autoUnloadMinutes = 60;

const MENU_IDS = {
  showVersion: 'show-version',
  openFullView: 'open-full-view',
  openOptions: 'open-options',
  unloadTab: 'native-unload-tab'
};

async function applyAutoDiscardable() {
  try {
    const tabs = await browser.tabs.query({});
    await Promise.all(tabs.map(t =>
      browser.tabs.update(t.id, { autoDiscardable: !autoUnload }).catch(() => {})
    ));
  } catch (_) {}
}

// Cache of all tabs for the extension page
let allTabCache = [];


// Track duplicate tabs by URL
const dupMap = new Map();
const dupIds = new Set();
const tabUrlMap = new Map();
let dupUpdateTimer = null;

function sendDuplicateUpdate() {
  browser.runtime.sendMessage({ type: 'duplicatesUpdated', duplicates: Array.from(dupIds) })
    .catch(() => {});
}

function scheduleDuplicateUpdate() {
  if (!dupUpdateTimer) {
    dupUpdateTimer = setTimeout(() => {
      dupUpdateTimer = null;
      sendDuplicateUpdate();
    }, 200);
  }
}

function addDuplicate(tabId, url) {
  tabUrlMap.set(tabId, url);
  let ids = dupMap.get(url);
  if (!ids) {
    ids = new Set([tabId]);
    dupMap.set(url, ids);
  } else {
    ids.add(tabId);
    if (ids.size > 1) {
      for (const id of ids) dupIds.add(id);
    }
  }
  scheduleDuplicateUpdate();
}

function removeDuplicate(tabId) {
  const url = tabUrlMap.get(tabId);
  if (!url) return;
  tabUrlMap.delete(tabId);
  const ids = dupMap.get(url);
  if (!ids) return;
  if (ids.delete(tabId)) {
    if (ids.size <= 1) {
      for (const id of ids) dupIds.delete(id);
    }
    if (ids.size === 0) dupMap.delete(url);
    dupIds.delete(tabId);
    scheduleDuplicateUpdate();
  }
}

function sendVisitedUpdate() {
  browser.runtime.sendMessage({ type: 'visitedUpdated', visited: Array.from(visited) })
    .catch(() => {});
}

async function clearVisitHistory() {
  recent = [];
  visited = new Set();
  await browser.storage.local.remove(['recent', 'visited']).catch(() => {});
  sendVisitedUpdate();
}

async function updateTabCache() {
  try {
    allTabCache = await browser.tabs.query({ windowType: 'normal' });
  } catch (_) {
    allTabCache = [];
  }
}

function sendTabState() {
  browser.runtime.sendMessage({
    type: 'tabState',
    tabs: allTabCache,
    visited: Array.from(visited)
  }).catch(() => {});
}

async function refreshTabState() {
  await updateTabCache();
  sendTabState();
}

setInterval(refreshTabState, 5000);

// Restore persisted data
browser.storage.local.get([
  'autoUnload',
  'autoUnloadMinutes',
  'recent',
  'visited'
]).then(async data => {
  if (typeof data.autoUnload === 'boolean') autoUnload = data.autoUnload;
  if (typeof data.autoUnloadMinutes === 'number') {
    autoUnloadMinutes = data.autoUnloadMinutes;
  }
  if (Array.isArray(data.recent)) recent = data.recent;
  if (Array.isArray(data.visited)) visited = new Set(data.visited);
  await applyAutoDiscardable();
  refreshTabState();
});

// Clear visit history only when Firefox starts
browser.runtime.onStartup.addListener(async () => {
  await browser.storage.local.remove(['visited', 'recent']).catch(() => {});
  visited = new Set();
  recent = [];
  try {
    const activeTabs = await browser.tabs.query({ windowType: 'normal', active: true });
    for (const tab of activeTabs) {
      pushRecent(tab.id);
      markVisited(tab.id);
    }
  } catch (e) {
    console.error('Failed to seed active tabs after startup', e);
  }
  sendVisitedUpdate();
  refreshTabState();
  await createContextMenus();
});

// Listen for settings changes
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.autoUnload) {
      autoUnload = changes.autoUnload.newValue;
      applyAutoDiscardable();
    }
    if (changes.autoUnloadMinutes) autoUnloadMinutes = changes.autoUnloadMinutes.newValue;
  }
});

// Initialize duplicate tracking
browser.tabs.query({}).then(tabs => {
  for (const t of tabs) {
    addDuplicate(t.id, t.url);
  }
  refreshTabState();
});

// Apply user-defined keyboard shortcuts if supported
(async () => {
  try {
    const {
      keyOpenPopup = 'Alt+Shift+H',
      keyOpenFull = 'Alt+Shift+F',
      keyUnloadAll = 'Alt+Shift+U'
    } = await browser.storage.local.get([
      'keyOpenPopup', 'keyOpenFull', 'keyUnloadAll'
    ]);
    if (browser.commands && browser.commands.update) {
      try { await browser.commands.update({ name: 'open-tabs-helper', shortcut: keyOpenPopup }); } catch (_) {}
      try { await browser.commands.update({ name: 'open-tabs-helper-full', shortcut: keyOpenFull }); } catch (_) {}
      try { await browser.commands.update({ name: 'unload-all-tabs', shortcut: keyUnloadAll }); } catch (_) {}
    }
    if (action && action.setTitle) {
      action.setTitle({ title: `KepiTAB Manager (${keyOpenFull})` });
    }
  } catch (e) {
    console.error('Failed to apply shortcuts', e);
  }
})();

function unmarkVisited(tabId) {
  if (visited.delete(tabId)) {
    browser.storage.local.set({ visited: Array.from(visited) }).catch(() => {});
    sendVisitedUpdate();
  }
}

function scheduleRecentSave() {
  if (!recentTimer) {
    recentTimer = setTimeout(() => {
      recentTimer = null;
      browser.storage.local.set({ recent });
    }, 500);
  }
}

async function createContextMenus() {
  if (!browser.contextMenus) return;

  const versionTitle = `KepiTAB Manager v${browser.runtime.getManifest().version}`;
  const definitions = [
    {
      id: MENU_IDS.showVersion,
      title: versionTitle,
      contexts: ['action', 'browser_action']
    },
    {
      id: MENU_IDS.openFullView,
      title: 'Open Full View',
      contexts: ['action', 'browser_action']
    },
    {
      id: MENU_IDS.openOptions,
      title: 'Options',
      contexts: ['action', 'browser_action']
    },
    {
      id: MENU_IDS.unloadTab,
      title: 'Unload Tab',
      contexts: ['tab']
    }
  ];

  await Promise.all(definitions.map(async (def) => {
    try {
      await browser.contextMenus.remove(def.id);
    } catch (_) {}
  }));

  for (const def of definitions) {
    try {
      await browser.contextMenus.create(def);
    } catch (e) {
      console.error('Failed to create context menu', def.id, e);
    }
  }
}

function pushRecent(tabId) {
  const idx = recent.indexOf(tabId);
  if (idx !== -1) recent.splice(idx, 1);
  recent.unshift(tabId);
  if (recent.length > MAX_RECENT) recent.pop();
  scheduleRecentSave();
}

function reorderRecent(ids, toId, before) {
  ids = ids.filter(id => id !== toId);
  if (!ids.length) return;
  recent = recent.filter(id => !ids.includes(id));
  let idx = recent.indexOf(toId);
  if (idx === -1) idx = recent.length;
  if (!before) idx += 1;
  recent.splice(idx, 0, ...ids);
  scheduleRecentSave();
}


function markVisited(tabId) {
  if (!visited.has(tabId)) {
    visited.add(tabId);
    browser.storage.local.set({ visited: Array.from(visited) }).catch(() => {});
    sendVisitedUpdate();
  }
  if (!autoUnload) {
    browser.tabs.update(tabId, { autoDiscardable: false }).catch(() => {});
  }
}

browser.tabs.onActivated.addListener(info => {
  pushRecent(info.tabId);
  markVisited(info.tabId);
  refreshTabState();
});

browser.tabs.onCreated.addListener(tab => {
  addDuplicate(tab.id, tab.url);
  if (!autoUnload) {
    browser.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
  }
  refreshTabState();
});

browser.tabs.onRemoved.addListener((tabId) => {
  const ridx = recent.indexOf(tabId);
  if (ridx !== -1) {
    recent.splice(ridx, 1);
    scheduleRecentSave();
  }
  if (visited.delete(tabId)) {
    browser.storage.local.set({ visited: Array.from(visited) }).catch(() => {});
    sendVisitedUpdate();
  }
  removeDuplicate(tabId);
  refreshTabState();
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.discarded === false && tab && tab.active) {
    markVisited(tabId);
  }
  if (changeInfo.url) {
    removeDuplicate(tabId);
    addDuplicate(tabId, changeInfo.url);
  }
  refreshTabState();
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'getRecent') {
    return Promise.resolve({ recent });
  } else if (msg && msg.type === 'getVisited') {
    return Promise.resolve({ visited: Array.from(visited) });
  } else if (msg && msg.type === 'getDuplicates') {
    return Promise.resolve({ duplicates: Array.from(dupIds) });
  } else if (msg && msg.type === 'getTabState') {
    return Promise.resolve({ tabs: allTabCache, visited: Array.from(visited) });
  } else if (msg && msg.type === 'unmarkVisited') {
    unmarkVisited(msg.tabId);
  } else if (msg && msg.type === 'reorderRecent') {
    reorderRecent(msg.ids || [], msg.toId, msg.before);
  } else if (msg && msg.type === 'clearVisitHistory') {
    clearVisitHistory();
  } else if (msg && msg.type === 'openFullView') {
    return openFullView();
  } else if (msg && msg.type === 'discardTabs') {
    return discardTabs(msg.tabIds, { keepVisited: msg.keepVisited });
  } else if (msg && msg.type === 'unloadAllTabs') {
    return unloadAllTabs();
  }
});

async function discardTabs(tabIds, { keepVisited = false } = {}) {
  const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
  const uniqueIds = Array.from(new Set(ids.filter(id => typeof id === 'number')));
  if (!uniqueIds.length) return [];

  const discardedIds = new Set();

  for (const id of uniqueIds) {
    try {
      const result = await browser.tabs.discard(id);
      if (Array.isArray(result)) {
        for (const tab of result) {
          if (tab && typeof tab.id === 'number') discardedIds.add(tab.id);
        }
      } else if (result && typeof result.id === 'number') {
        discardedIds.add(result.id);
      } else {
        discardedIds.add(id);
      }
    } catch (_) {}
  }

  if (!keepVisited) {
    for (const id of discardedIds) {
      unmarkVisited(id);
    }
  }

  return Array.from(discardedIds);
}

async function openFullView() {
  const fullUrl = browser.runtime.getURL('full.html');
  const wins = await browser.windows.getAll({ populate: true });

  for (const win of wins) {
    const tab = (win.tabs || []).find(t => t.url === fullUrl);
    if (tab) {
      try {
        await browser.windows.update(win.id, { focused: true });
        await browser.tabs.update(tab.id, { active: true });
      } catch (_) {}
      return;
    }
  }

  const { fullSize } = await browser.storage.local.get('fullSize');
  const createData = {
    url: fullUrl,
    type: 'popup'
  };
  if (fullSize) {
    if (typeof fullSize.width === 'number' && typeof fullSize.height === 'number') {
      createData.width = fullSize.width;
      createData.height = fullSize.height;
    }
    if (typeof fullSize.left === 'number' && typeof fullSize.top === 'number') {
      createData.left = fullSize.left;
      createData.top = fullSize.top;
    }
  }
  await browser.windows.create(createData);
}

async function unloadAllTabs() {
  const tabs = await browser.tabs.query({});
  const ids = tabs.filter(t => !t.discarded).map(t => t.id);
  await discardTabs(ids);
  await browser.storage.local.remove(['visited', 'recent']).catch(() => {});
  visited = new Set();
  recent = [];
  sendVisitedUpdate();
}

async function checkAutoUnload() {
  if (!autoUnload) return;
  const threshold = Date.now() - autoUnloadMinutes * 60000;
  try {
    const tabs = await browser.tabs.query({});
    await Promise.all(tabs.map(async t => {
      if (!t.discarded && !t.active && t.lastAccessed && t.lastAccessed < threshold) {
        await discardTabs(t.id);
      }
    }));
  } catch (e) {
    console.error('Auto unload failed', e);
  }
}

setInterval(checkAutoUnload, 60000);

// Open the multi-column tab manager when the icon is middle-clicked.
if (action && action.onClicked && action.onClicked.addListener) {
  action.onClicked.addListener((tab, info) => {
    if (info && info.button === 1) {
      openFullView();
    }
  });
}

browser.commands.onCommand.addListener((command) => {
  if (command === 'open-tabs-helper') {
    if (action && action.openPopup) {
      action.openPopup();
    }
  } else if (command === 'open-tabs-helper-full') {
    openFullView();
  } else if (command === 'unload-all-tabs') {
    unloadAllTabs();
  }
});

browser.runtime.onInstalled.addListener(async () => {
  await clearVisitHistory();
  await createContextMenus();
});

browser.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === MENU_IDS.openFullView) {
    openFullView();
  } else if (info.menuItemId === MENU_IDS.openOptions) {
    browser.runtime.openOptionsPage();
  } else if (info.menuItemId === MENU_IDS.unloadTab && typeof info.tabId === 'number') {
    await discardTabs(info.tabId);
  }
});
