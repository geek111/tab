const MENU_ID = "unload-tab";
const SWITCH_DELAY_MS = 120;

const action = browser.action;
const placeholderTabs = new Map();

function logDiscardChange(tabId, changeInfo, tab) {
  if (Object.prototype.hasOwnProperty.call(changeInfo, "discarded")) {
    console.log(`[tabs.onUpdated] Tab ${tabId} discarded=${tab.discarded}`);
  }
}

browser.tabs.onUpdated.addListener(logDiscardChange);

browser.tabs.onRemoved.addListener(tabId => {
  placeholderTabs.delete(tabId);
});

browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (placeholderTabs.size === 0) {
    return;
  }

  if (placeholderTabs.has(tabId)) {
    return;
  }

  const toRemove = [];
  for (const [id, winId] of placeholderTabs.entries()) {
    if (winId === windowId) {
      toRemove.push(id);
      placeholderTabs.delete(id);
    }
  }

  if (toRemove.length === 0) {
    return;
  }

  try {
    await browser.tabs.remove(toRemove);
  } catch (error) {
    console.warn("Failed to remove placeholder tabs after activation change", error);
  }
});

async function createMenu() {
  try {
    await browser.contextMenus.removeAll();
    await browser.contextMenus.create({
      id: MENU_ID,
      title: "Unload Tab",
      contexts: ["tab"]
    });
  } catch (error) {
    console.error("Failed to create context menu", error);
  }
}

browser.runtime.onInstalled.addListener(() => {
  createMenu().catch(error => console.error("Failed to initialise context menu", error));
});

createMenu().catch(error => console.error("Failed to create context menu on startup", error));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureNotActive(tabId) {
  const tab = await browser.tabs.get(tabId);
  if (!tab.active) {
    return { tab, placeholderId: null };
  }

  const { windowId } = tab;
  const candidates = await browser.tabs.query({ windowId, active: false });
  if (candidates.length > 0) {
    await browser.tabs.update(candidates[0].id, { active: true });
    return { tab, placeholderId: null };
  }

  const placeholder = await browser.tabs.create({
    windowId,
    url: "about:blank",
    active: true
  });

  placeholderTabs.set(placeholder.id, windowId);
  return { tab, placeholderId: placeholder.id };
}

async function verifyDiscard(tabId) {
  const updated = await browser.tabs.get(tabId);
  if (!updated.discarded) {
    throw new Error("Tab is not discarded after browser.tabs.discard call");
  }
  return updated;
}

async function discardOne(tabId) {
  try {
    const { tab } = await ensureNotActive(tabId);
    if (tab.discarded) {
      return tab;
    }

    if (tab.active) {
      await sleep(SWITCH_DELAY_MS);
    }
    await browser.tabs.discard(tabId);
    const updated = await verifyDiscard(tabId);

    return updated;
  } catch (error) {
    console.error(`Failed to discard tab ${tabId}`, error);
    throw error;
  }
}

async function discardMany(tabIds) {
  const uniqueIds = [...new Set(tabIds.filter(id => typeof id === "number"))];
  const results = [];
  for (const id of uniqueIds) {
    try {
      const tab = await discardOne(id);
      results.push({ tabId: id, success: true, tab });
    } catch (error) {
      results.push({ tabId: id, success: false, error });
    }
  }
  return results;
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || tab.id === undefined) {
    return;
  }

  try {
    await discardOne(tab.id);
  } catch (error) {
    console.error("Context menu discard failed", error);
  }
});

action.onClicked.addListener(async activeTab => {
  if (!activeTab || activeTab.windowId === undefined) {
    return;
  }

  try {
    const highlighted = await browser.tabs.query({
      windowId: activeTab.windowId,
      highlighted: true
    });
    const ids = highlighted.map(t => t.id).filter(id => id !== undefined);
    if (!ids.includes(activeTab.id)) {
      ids.push(activeTab.id);
    }
    await discardMany(ids);
  } catch (error) {
    console.error("Action discard failed", error);
  }
});

globalThis.ensureNotActive = ensureNotActive;
globalThis.discardOne = discardOne;
globalThis.discardMany = discardMany;
