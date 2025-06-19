const MAX_RECENT = 30;
const action = browser.browserAction || browser.action;

let recent = [];
let visited = new Set();
let recentTimer = null;
let visitedTimer = null;

const nativeGroups = !!(browser.tabGroups && browser.tabs.group);

let groups = [];
let tabGroups = new Map();
let nextGroupId = 1;
let groupsTimer = null;
let tabGroupsTimer = null;

function scheduleGroupsSave() {
  if (nativeGroups) return;
  if (!groupsTimer) {
    groupsTimer = setTimeout(() => {
      groupsTimer = null;
      browser.storage.local.set({ groups, nextGroupId });
    }, 500);
  }
}

function scheduleTabGroupsSave() {
  if (nativeGroups) return;
  if (!tabGroupsTimer) {
    tabGroupsTimer = setTimeout(() => {
      tabGroupsTimer = null;
      browser.storage.local.set({ tabGroups: Object.fromEntries(tabGroups) });
    }, 500);
  }
}

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

browser.storage.local.get(['recent', 'visited']).then(data => {
  recent = data.recent || [];
  visited = new Set(data.visited || []);
});

if (!nativeGroups) {
  browser.storage.local.get(['groups', 'tabGroups', 'nextGroupId']).then(data => {
    groups = data.groups || [];
    nextGroupId = data.nextGroupId || 1;
    const tg = data.tabGroups || {};
    tabGroups = new Map(Object.entries(tg).map(([k, v]) => [parseInt(k, 10), v]));
  });
}

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
      action.setTitle({ title: `KepiTAB (${keyOpenPopup})` });
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
  pushRecent(tab.id);
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
  if (!nativeGroups && tabGroups.delete(tabId)) {
    scheduleTabGroupsSave();
  }
  removeDuplicate(tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.discarded === true) {
    unmarkVisited(tabId);
  } else if (changeInfo.discarded === false) {
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
  } else if (msg && msg.type === 'getGroups') {
    if (nativeGroups) {
      return Promise.all([
        browser.tabGroups.query({}),
        browser.tabs.query({})
      ]).then(([gs, tabs]) => {
        const m = {};
        for (const t of tabs) {
          if (t.groupId >= 0) m[t.id] = t.groupId;
        }
        return { groups: gs.map(g => ({ id: g.id, name: g.title || 'Group' })), tabGroups: m };
      });
    }
    return Promise.resolve({
      groups,
      tabGroups: Object.fromEntries(tabGroups)
    });
  } else if (msg && msg.type === 'createGroup') {
    if (nativeGroups) {
      return browser.tabs.group({ tabIds: msg.ids || [] }).then(async groupId => {
        if (msg.name) {
          try { await browser.tabGroups.update(groupId, { title: msg.name }); } catch (_) {}
        }
        return { groups: await browser.tabGroups.query({}) };
      });
    }
    const id = nextGroupId++;
    groups.push({ id, name: msg.name || 'Group' });
    scheduleGroupsSave();
    return Promise.resolve({ groups });
  } else if (msg && msg.type === 'deleteGroup') {
    if (nativeGroups) {
      return browser.tabs.query({ groupId: msg.id }).then(tabs => {
        const ids = tabs.map(t => t.id);
        if (ids.length) return browser.tabs.ungroup(ids);
      }).then(() => browser.tabGroups.query({})).then(gs => ({ groups: gs }));
    }
    groups = groups.filter(g => g.id !== msg.id);
    for (const [k, v] of Array.from(tabGroups)) {
      if (v === msg.id) tabGroups.delete(parseInt(k, 10));
    }
    scheduleGroupsSave();
    scheduleTabGroupsSave();
    return Promise.resolve({ groups });
  } else if (msg && msg.type === 'renameGroup') {
    if (nativeGroups) {
      return browser.tabGroups.update(msg.id, { title: msg.name }).then(() => browser.tabGroups.query({})).then(gs => ({ groups: gs }));
    }
    const g = groups.find(g => g.id === msg.id);
    if (g) {
      g.name = msg.name || g.name;
      scheduleGroupsSave();
    }
    return Promise.resolve({ groups });
  } else if (msg && msg.type === 'assignGroups') {
    if (nativeGroups) {
      if (msg.groupId) {
        return browser.tabs.group({ groupId: msg.groupId, tabIds: msg.ids || [] }).then(() => ({}));
      }
      return browser.tabs.ungroup(msg.ids || []).then(() => ({}));
    }
    (msg.ids || []).forEach(id => {
      if (msg.groupId) tabGroups.set(id, msg.groupId);
      else tabGroups.delete(id);
    });
    scheduleTabGroupsSave();
    return Promise.resolve({});
  }
});

async function openFullView() {
  const { fullSize } = await browser.storage.local.get('fullSize');
  const createData = {
    url: browser.runtime.getURL('full.html'),
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
        unmarkVisited(t.id);
      } catch (_) {}
    }));
}

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
    browser.tabs.create({ url: browser.runtime.getURL('full.html') });
  } else if (command === 'unload-all-tabs') {
    unloadAllTabs();
  }
});

browser.runtime.onInstalled.addListener(async () => {
  await browser.contextMenus.create({
    id: 'show-version',
    title: `KepiTAB v${browser.runtime.getManifest().version}`,
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
