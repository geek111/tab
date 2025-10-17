const CONTEXT_MENU_ID = "unload-tab";
const SWITCH_DELAY_MS = 120;
const VERIFY_ATTEMPTS = 15;
const VERIFY_DELAY_MS = 100;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureNotActive(tabId) {
  const tab = await browser.tabs.get(tabId);
  if (!tab) {
    throw new Error(`Tab ${tabId} is unavailable.`);
  }

  if (!tab.active) {
    return { tab, tempTabId: null };
  }

  const siblings = await browser.tabs.query({ windowId: tab.windowId });
  const alternative =
    siblings.find(t => t.id !== tabId && !t.discarded) ||
    siblings.find(t => t.id !== tabId);

  if (alternative) {
    await browser.tabs.update(alternative.id, { active: true });
    await sleep(SWITCH_DELAY_MS);
    return { tab, tempTabId: null };
  }

  const tempTab = await browser.tabs.create({
    windowId: tab.windowId,
    url: "about:blank",
    active: true
  });

  await sleep(SWITCH_DELAY_MS);
  return { tab, tempTabId: tempTab.id };
}

async function waitForDiscard(tabId) {
  for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt += 1) {
    const state = await browser.tabs.get(tabId).catch(() => null);
    if (!state) {
      throw new Error(`Tab ${tabId} was closed before it could be verified.`);
    }
    if (state.discarded) {
      return state;
    }
    await sleep(VERIFY_DELAY_MS);
  }
  throw new Error(`Tab ${tabId} did not enter discarded state in time.`);
}

async function discardOne(tabId) {
  let tempTabId = null;
  let originalTab;
  try {
    const preparation = await ensureNotActive(tabId);
    tempTabId = preparation.tempTabId;
    originalTab = preparation.tab;
  } catch (error) {
    console.error(`Unable to prepare tab ${tabId} for discard`, error);
    throw error;
  }

  try {
    await browser.tabs.discard([tabId]);
  } catch (error) {
    console.error(`Discard request for tab ${tabId} failed`, error);
    throw error;
  }

  let finalState;
  try {
    finalState = await waitForDiscard(tabId);
  } catch (error) {
    console.error(`Verification of tab ${tabId} discard state failed`, error);
    throw error;
  } finally {
    if (tempTabId !== null) {
      try {
        const windowId = finalState?.windowId ?? originalTab?.windowId;
        if (typeof windowId === "number") {
          const tabsInWindow = await browser.tabs.query({ windowId });
          const hasOther = tabsInWindow.some(t => t.id !== tabId && t.id !== tempTabId);
          if (hasOther) {
            const fallback = tabsInWindow.find(t => t.id !== tabId && t.id !== tempTabId);
            if (fallback) {
              await browser.tabs.update(fallback.id, { active: true }).catch(() => {});
            }
            await browser.tabs.remove(tempTabId).catch(() => {});
          }
        }
      } catch (cleanupError) {
        console.warn(`Cleanup of temporary tab ${tempTabId} failed`, cleanupError);
      }
    }
  }

  return finalState;
}

async function discardMany(tabIds) {
  const uniqueIds = [...new Set(tabIds)].filter(id => typeof id === "number");
  if (uniqueIds.length === 0) {
    return [];
  }

  const tabStates = await Promise.all(uniqueIds.map(id => browser.tabs.get(id).catch(() => null)));
  const validTabs = tabStates.filter(Boolean);
  validTabs.sort((a, b) => Number(a.active) - Number(b.active));

  const discarded = [];
  const failures = [];
  for (const tab of validTabs) {
    try {
      const result = await discardOne(tab.id);
      discarded.push(result);
    } catch (error) {
      console.error(`Failed to discard tab ${tab.id}`, error);
      failures.push({ tabId: tab.id, error });
    }
  }

  if (failures.length > 0) {
    const aggregate = new Error(`Failed to discard ${failures.length} tab(s).`);
    aggregate.details = failures;
    throw aggregate;
  }

  return discarded;
}

function registerContextMenu() {
  browser.contextMenus.removeAll().finally(() => {
    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Unload Tab",
      contexts: ["tab"]
    });
  });
}

browser.runtime.onInstalled.addListener(registerContextMenu);
registerContextMenu();

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.tabId) {
    return;
  }
  try {
    await discardOne(info.tabId);
  } catch (error) {
    console.error(`Context menu unload failed for tab ${info.tabId}`, error);
  }
});

browser.action.onClicked.addListener(async (tab) => {
  if (!tab || typeof tab.windowId !== "number") {
    return;
  }

  try {
    const highlighted = await browser.tabs.query({
      windowId: tab.windowId,
      highlighted: true
    });

    const ids = highlighted.length > 0 ? highlighted.map(t => t.id) : [tab.id];
    await discardMany(ids);
  } catch (error) {
    console.error("Bulk unload failed", error);
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (Object.prototype.hasOwnProperty.call(changeInfo, "discarded")) {
    console.log(`Tab ${tabId} discarded state: ${tab.discarded}`);
  }
});
