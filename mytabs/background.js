const MAX_RECENT = 30;

let recent = [];
let visited = [];
let recentTimer = null;
let visitedTimer = null;
let lastActive = {};
let autoSuspendEnabled = false;
let autoSuspendMin = 10;
let autoTimer = null;

browser.storage.local.get(['recent', 'visited', 'autoSuspend', 'autoSuspendMin']).then(data => {
  recent = data.recent || [];
  visited = data.visited || [];
  autoSuspendEnabled = data.autoSuspend || false;
  autoSuspendMin = data.autoSuspendMin || 10;
  if (autoSuspendEnabled) startAutoTimer();
});

browser.storage.onChanged.addListener(changes => {
  if ('autoSuspend' in changes || 'autoSuspendMin' in changes) {
    autoSuspendEnabled = changes.autoSuspend ? changes.autoSuspend.newValue : autoSuspendEnabled;
    autoSuspendMin = changes.autoSuspendMin ? changes.autoSuspendMin.newValue : autoSuspendMin;
    if (autoSuspendEnabled) startAutoTimer();
    else if (autoTimer) { clearInterval(autoTimer); autoTimer=null; }
  }
});

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

function startAutoTimer() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(checkAutoSuspend, 60000);
}

async function checkAutoSuspend() {
  if (!autoSuspendEnabled) return;
  const tabs = await browser.tabs.query({});
  const now = Date.now();
  for (const tab of tabs) {
    const ts = lastActive[tab.id] || now;
    if (!tab.active && !tab.discarded && now - ts > autoSuspendMin * 60000) {
      browser.tabs.discard(tab.id).catch(()=>{});
    }
  }
}

browser.tabs.onActivated.addListener(info => {
  pushRecent(info.tabId);
  markVisited(info.tabId);
  lastActive[info.tabId] = Date.now();
});

browser.tabs.onCreated.addListener(tab => {
  lastActive[tab.id] = Date.now();
});

browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  if (changeInfo.active) {
    lastActive[id] = Date.now();
  }
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
  delete lastActive[tabId];
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'getRecent') {
    return Promise.resolve({ recent });
  } else if (msg && msg.type === 'getVisited') {
    return Promise.resolve({ visited });
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
    .map(t => browser.tabs.discard(t.id).catch(() => {})));
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

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'show-version',
    title: `KepiTAB v${browser.runtime.getManifest().version}`,
    contexts: ['browser_action']
  });
  browser.contextMenus.create({
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
