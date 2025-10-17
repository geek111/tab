const MENU_ID = "unload-tab";
const WAIT_AFTER_DEACTIVATION_MS = 120;
const VERIFY_MAX_ATTEMPTS = 5;
const VERIFY_DELAY_MS = 120;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureNotActive(tabId) {
  const tab = await browser.tabs.get(tabId);
  if (!tab) {
    throw new Error(`Tab ${tabId} not found`);
  }

  if (!tab.active) {
    return { tab, wasActive: false };
  }

  const siblings = await browser.tabs.query({ windowId: tab.windowId });
  const target = siblings.find((candidate) => candidate.id !== tabId && candidate.windowId === tab.windowId);

  if (target) {
    await browser.tabs.update(target.id, { active: true });
    return { tab, wasActive: true };
  }

  await browser.tabs.create({ windowId: tab.windowId, url: "about:blank", active: true });
  return { tab, wasActive: true };
}

async function verifyDiscarded(tabId) {
  for (let attempt = 0; attempt < VERIFY_MAX_ATTEMPTS; attempt += 1) {
    const refreshed = await browser.tabs.get(tabId);
    if (refreshed.discarded) {
      return refreshed;
    }
    await sleep(VERIFY_DELAY_MS);
  }
  throw new Error(`Tab ${tabId} failed to enter discarded state`);
}

async function discardOne(tabId) {
  let context;
  try {
    context = await ensureNotActive(tabId);
  } catch (error) {
    console.error(`Failed to ensure tab ${tabId} is inactive before discarding`, error);
    throw error;
  }

  if (context.wasActive) {
    await sleep(WAIT_AFTER_DEACTIVATION_MS);
  }

  try {
    await browser.tabs.discard(tabId);
  } catch (error) {
    console.error(`Discard API rejected for tab ${tabId}`, error);
    throw error;
  }

  try {
    const verified = await verifyDiscarded(tabId);
    console.log(`Tab ${tabId} discarded: true`);
    return verified;
  } catch (error) {
    console.error(`Discard verification failed for tab ${tabId}`, error);
    throw error;
  }
}

async function discardMany(tabIds) {
  const unique = Array.from(new Set(tabIds.filter((id) => typeof id === "number")));
  const results = [];

  for (const id of unique) {
    try {
      const tab = await discardOne(id);
      results.push({ tabId: id, success: true, tab });
    } catch (error) {
      results.push({ tabId: id, success: false, error });
    }
  }

  return results;
}

function handleContextMenuClick(info, tab) {
  if (info.menuItemId !== MENU_ID || !tab || typeof tab.id !== "number") {
    return;
  }

  discardMany([tab.id]).catch((error) => {
    console.error(`Context menu discard failed for tab ${tab.id}`, error);
  });
}

async function handleActionClick(activeTab) {
  if (!activeTab || typeof activeTab.windowId !== "number") {
    return;
  }

  const highlighted = await browser.tabs.query({ windowId: activeTab.windowId, highlighted: true });
  const targets = highlighted.map((tab) => tab.id).filter((id) => typeof id === "number");

  if (targets.length === 0 && typeof activeTab.id === "number") {
    targets.push(activeTab.id);
  }

  discardMany(targets).catch((error) => {
    console.error(`Action click discard failed in window ${activeTab.windowId}`, error);
  });
}

async function createContextMenu() {
  try {
    await browser.contextMenus.remove(MENU_ID);
  } catch (error) {
    console.debug("Ignoring menu removal error", error);
  }

  try {
    browser.contextMenus.create({
      id: MENU_ID,
      title: "Unload Tab",
      contexts: ["tab"],
    });
  } catch (error) {
    console.error("Creating context menu failed", error);
  }
}

browser.contextMenus.onClicked.addListener(handleContextMenuClick);
browser.action.onClicked.addListener(handleActionClick);

browser.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

if (browser.runtime.onStartup) {
  browser.runtime.onStartup.addListener(() => {
    createContextMenu();
  });
}

createContextMenu();

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (Object.prototype.hasOwnProperty.call(changeInfo, "discarded")) {
    console.log(`tabs.onUpdated => ${tabId} discarded=${changeInfo.discarded}`);
  }
});
