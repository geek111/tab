const MENU_ID = "unload-tab";
const SWITCH_DELAY_MS = 120;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureContextMenus() {
  try {
    await browser.contextMenus.removeAll();
  } catch (error) {
    console.warn("Failed to clear context menus", error);
  }
  browser.contextMenus.create({
    id: MENU_ID,
    title: "Unload Tab",
    contexts: ["tab"]
  }, () => {
    if (browser.runtime.lastError) {
      console.error("Failed to create context menu", browser.runtime.lastError);
    }
  });
}

ensureContextMenus();

browser.runtime.onInstalled.addListener(() => {
  ensureContextMenus();
});

browser.runtime.onStartup.addListener(() => {
  ensureContextMenus();
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (Object.prototype.hasOwnProperty.call(changeInfo, "discarded")) {
    console.log(`[discard-monitor] Tab ${tabId} discarded=${changeInfo.discarded}`);
  }
});

async function ensureNotActive(tabId) {
  const tab = await browser.tabs.get(tabId);
  if (!tab) {
    throw new Error(`Tab ${tabId} not found`);
  }
  if (!tab.active) {
    return tab;
  }

  const candidates = await browser.tabs.query({ windowId: tab.windowId });
  let fallback = candidates.find(t => t.id !== tabId && !t.discarded && !t.pinned);
  if (!fallback) {
    fallback = candidates.find(t => t.id !== tabId && !t.discarded);
  }
  if (fallback) {
    await browser.tabs.update(fallback.id, { active: true });
  } else {
    await browser.tabs.create({
      windowId: tab.windowId,
      url: "about:blank",
      active: true
    });
  }

  await sleep(SWITCH_DELAY_MS);

  return tab;
}

async function waitForDiscarded(tabId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const fresh = await browser.tabs.get(tabId);
    if (fresh.discarded) {
      return fresh;
    }
    await sleep(50);
  }
  const latest = await browser.tabs.get(tabId);
  if (!latest.discarded) {
    throw new Error(`Tab ${tabId} did not enter discarded state`);
  }
  return latest;
}

async function discardOne(tabId) {
  try {
    const initial = await browser.tabs.get(tabId);
    if (!initial) {
      throw new Error(`Tab ${tabId} not found`);
    }
    if (initial.discarded) {
      return initial;
    }

    await ensureNotActive(tabId);
    try {
      await browser.tabs.discard(tabId);
    } catch (error) {
      console.error(`Failed to discard tab ${tabId}`, error);
      throw error;
    }

    const verified = await waitForDiscarded(tabId);
    return verified;
  } catch (error) {
    console.error(`discardOne(${tabId})`, error);
    throw error;
  }
}

async function discardMany(tabIds) {
  const unique = Array.from(new Set(tabIds));
  const results = [];

  for (const id of unique) {
    try {
      const tab = await discardOne(id);
      results.push({ tab, error: null });
    } catch (error) {
      results.push({ tab: null, error });
    }
  }

  return results;
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab) {
    return;
  }

  try {
    await discardOne(tab.id);
  } catch (error) {
    console.error("Failed to handle context menu discard", error);
  }
});

browser.action.onClicked.addListener(async (tab) => {
  if (!tab) {
    return;
  }

  try {
    const highlighted = await browser.tabs.query({
      windowId: tab.windowId,
      highlighted: true
    });

    const active = highlighted.find(t => t.active);
    const ordered = highlighted
      .filter(t => !t.active)
      .map(t => t.id);
    if (active) {
      ordered.push(active.id);
    }

    await discardMany(ordered);
  } catch (error) {
    console.error("Failed to discard highlighted tabs", error);
  }
});

browser.runtime.onMessage.addListener((message) => {
  if (message && message.type === "discardMany") {
    return discardMany(message.tabIds || []);
  }
  return undefined;
});
