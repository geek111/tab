// No cap on stored tabs so the Recent panel lists every visited tab
const MAX_RECENT = Infinity;
const action = browser.browserAction || browser.action;

let recent = [];
let visited = new Set();
let recentTimer = null;
let visitedTimer = null;
let autoUnload = false;
let autoUnloadMinutes = 60;


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

// Restore persisted data
browser.storage.local.get([
  'autoUnload',
  'autoUnloadMinutes',
  'recent',
  'visited'
]).then(data => {
  if (typeof data.autoUnload === 'boolean') autoUnload = data.autoUnload;
  if (typeof data.autoUnloadMinutes === 'number') {
    autoUnloadMinutes = data.autoUnloadMinutes;
  }
  if (Array.isArray(data.recent)) recent = data.recent;
  // Always start with a clean visited set to avoid stale state between sessions
  browser.storage.local.remove('visited').catch(() => {});
});

// Clear visited state when the browser starts
browser.runtime.onStartup.addListener(() => {
  visited = new Set();
  browser.storage.local.remove('visited').catch(() => {});
});

// Listen for settings changes
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.autoUnload) autoUnload = changes.autoUnload.newValue;
    if (changes.autoUnloadMinutes) autoUnloadMinutes = changes.autoUnloadMinutes.newValue;
  }
});

// Initialize duplicate tracking
browser.tabs.query({}).then(tabs => {
  for (const t of tabs) {
    addDuplicate(t.id, t.url);
  }
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
      action.setTitle({ title: `KepiTAB Manager (${keyOpenPopup})` });
    }
  } catch (e) {
    console.error('Failed to apply shortcuts', e);
  }
})();

function unmarkVisited(tabId) {
  if (visited.delete(tabId)) {
    scheduleVisitedSave();
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

function scheduleVisitedSave() {
  if (!visitedTimer) {
    visitedTimer = setTimeout(() => {
      visitedTimer = null;
      browser.storage.local.set({ visited: Array.from(visited) });
    }, 500);
  }
}

function markVisited(tabId) {
  if (!visited.has(tabId)) {
    visited.add(tabId);
    scheduleVisitedSave();
    sendVisitedUpdate();
  }
}

browser.tabs.onActivated.addListener(info => {
  pushRecent(info.tabId);
  markVisited(info.tabId);
});

browser.tabs.onCreated.addListener(tab => {
  addDuplicate(tab.id, tab.url);
});

browser.tabs.onRemoved.addListener((tabId) => {
  const ridx = recent.indexOf(tabId);
  if (ridx !== -1) {
    recent.splice(ridx, 1);
    scheduleRecentSave();
  }
  if (visited.delete(tabId)) {
    scheduleVisitedSave();
    sendVisitedUpdate();
  }
  removeDuplicate(tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.discarded === false && tab && tab.active) {
    markVisited(tabId);
  }
  if (changeInfo.url) {
    removeDuplicate(tabId);
    addDuplicate(tabId, changeInfo.url);
  }
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'getRecent') {
    return Promise.resolve({ recent });
  } else if (msg && msg.type === 'getVisited') {
    return Promise.resolve({ visited: Array.from(visited) });
  } else if (msg && msg.type === 'getDuplicates') {
    return Promise.resolve({ duplicates: Array.from(dupIds) });
  } else if (msg && msg.type === 'unmarkVisited') {
    unmarkVisited(msg.tabId);
  } else if (msg && msg.type === 'reorderRecent') {
    reorderRecent(msg.ids || [], msg.toId, msg.before);
  }
});

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
  await Promise.all(tabs.filter(t => !t.discarded)
    .map(async t => {
      try {
        await browser.tabs.discard(t.id);
      } catch (_) {}
    }));
}

async function checkAutoUnload() {
  if (!autoUnload) return;
  const threshold = Date.now() - autoUnloadMinutes * 60000;
  try {
    const tabs = await browser.tabs.query({});
    await Promise.all(tabs.map(async t => {
      if (!t.discarded && !t.active && t.lastAccessed && t.lastAccessed < threshold) {
        try {
          await browser.tabs.discard(t.id);
        } catch (_) {}
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
  await browser.contextMenus.create({
    id: 'show-version',
    title: `KepiTAB Manager v${browser.runtime.getManifest().version}`,
    contexts: ['browser_action']
  });
  await browser.contextMenus.create({
    id: 'open-options',
    title: 'Options',
    contexts: ['browser_action']
  });
});

browser.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'open-options') {
    browser.runtime.openOptionsPage();
  }
});
