const MAX_RECENT = 30;

let recent = [];
let visited = [];
let recentTimer = null;
let visitedTimer = null;

browser.storage.local.get(['recent', 'visited']).then(data => {
  recent = data.recent || [];
  visited = data.visited || [];
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
    if (browser.browserAction && browser.browserAction.setTitle) {
      browser.browserAction.setTitle({ title: `KepiTAB (${keyOpenPopup})` });
    }
  } catch (e) {
    console.error('Failed to apply shortcuts', e);
  }
})();

function unmarkVisited(tabId) {
  const idx = visited.indexOf(tabId);
  if (idx !== -1) {
    visited.splice(idx, 1);
    scheduleVisitedSave();
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

function scheduleVisitedSave() {
  if (!visitedTimer) {
    visitedTimer = setTimeout(() => {
      visitedTimer = null;
      browser.storage.local.set({ visited });
    }, 500);
  }
}

function markVisited(tabId) {
  if (!visited.includes(tabId)) {
    visited.push(tabId);
    scheduleVisitedSave();
  }
}

browser.tabs.onActivated.addListener(info => {
  pushRecent(info.tabId);
  markVisited(info.tabId);
});

browser.tabs.onRemoved.addListener((tabId) => {
  const ridx = recent.indexOf(tabId);
  if (ridx !== -1) {
    recent.splice(ridx, 1);
    scheduleRecentSave();
  }
  const vidx = visited.indexOf(tabId);
  if (vidx !== -1) {
    visited.splice(vidx, 1);
    scheduleVisitedSave();
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.discarded === true) {
    unmarkVisited(tabId);
  } else if (changeInfo.discarded === false) {
    markVisited(tabId);
  }
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'getRecent') {
    return Promise.resolve({ recent });
  } else if (msg && msg.type === 'getVisited') {
    return Promise.resolve({ visited });
  } else if (msg && msg.type === 'unmarkVisited') {
    unmarkVisited(msg.tabId);
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
browser.browserAction.onClicked.addListener((tab, info) => {
  if (info && info.button === 1) {
    openFullView();
  }
});

browser.commands.onCommand.addListener((command) => {
  if (command === 'open-tabs-helper') {
    browser.browserAction.openPopup();
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
