const MAX_RECENT = 30;

async function pushRecent(tabId) {
  const { recent = [] } = await browser.storage.local.get('recent');
  const idx = recent.indexOf(tabId);
  if (idx !== -1) recent.splice(idx, 1);
  recent.unshift(tabId);
  if (recent.length > MAX_RECENT) recent.pop();
  await browser.storage.local.set({ recent });
}

async function markVisited(tabId) {
  const { visited = [] } = await browser.storage.local.get('visited');
  if (!visited.includes(tabId)) {
    visited.push(tabId);
    await browser.storage.local.set({ visited });
  }
}

browser.tabs.onActivated.addListener(info => {
  pushRecent(info.tabId);
  markVisited(info.tabId);
});

browser.tabs.onRemoved.addListener((tabId) => {
  browser.storage.local.get('recent').then(({ recent = [] }) => {
    const idx = recent.indexOf(tabId);
    if (idx !== -1) {
      recent.splice(idx, 1);
      browser.storage.local.set({ recent });
    }
  });
  browser.storage.local.get('visited').then(({ visited = [] }) => {
    const i = visited.indexOf(tabId);
    if (i !== -1) {
      visited.splice(i, 1);
      browser.storage.local.set({ visited });
    }
  });
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'getRecent') {
    return browser.storage.local.get('recent');
  } else if (msg && msg.type === 'getVisited') {
    return browser.storage.local.get('visited');
  }
});

function openFullView() {
  browser.windows.create({
    url: browser.runtime.getURL('full.html'),
    type: 'popup'
  }).then(win => {
    if (win && win.id) {
      browser.windows.update(win.id, { state: 'maximized' });
    }
  });
}

async function unloadAllTabs() {
  const tabs = await browser.tabs.query({});
  for (const t of tabs) {
    if (!t.discarded) {
      try { await browser.tabs.discard(t.id); } catch (_) {}
    }
  }
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
    title: `My Tabs Helper v${browser.runtime.getManifest().version}`,
    contexts: ['browser_action']
  });
});
