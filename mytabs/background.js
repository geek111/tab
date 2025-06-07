const MAX_RECENT = 30;

async function pushRecent(tabId) {
  const { recent = [] } = await browser.storage.local.get('recent');
  const idx = recent.indexOf(tabId);
  if (idx !== -1) recent.splice(idx, 1);
  recent.unshift(tabId);
  if (recent.length > MAX_RECENT) recent.pop();
  await browser.storage.local.set({ recent });
}

browser.tabs.onActivated.addListener(info => {
  pushRecent(info.tabId);
});

browser.tabs.onRemoved.addListener((tabId) => {
  browser.storage.local.get('recent').then(({ recent = [] }) => {
    const idx = recent.indexOf(tabId);
    if (idx !== -1) {
      recent.splice(idx, 1);
      browser.storage.local.set({ recent });
    }
  });
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'getRecent') {
    return browser.storage.local.get('recent');
  }
});

function openFullView() {
  browser.windows.create({
    url: browser.runtime.getURL('full.html'),
    type: 'popup'
  });
}

browser.commands.onCommand.addListener((command) => {
  if (command === 'open-tabs-helper') {
    browser.browserAction.openPopup();
  } else if (command === 'open-tabs-helper-full') {
    browser.tabs.create({ url: browser.runtime.getURL('full.html') });
  }
});
