(function(global) {
  'use strict';

  const root = typeof global !== 'undefined' ? global : typeof globalThis !== 'undefined' ? globalThis : undefined;

  function getTabsApi() {
    const globalObject = root || (typeof self !== 'undefined' ? self : undefined);
    if (!globalObject) {
      return undefined;
    }
    if (globalObject.browser && globalObject.browser.tabs) {
      return globalObject.browser.tabs;
    }
    if (globalObject.chrome && globalObject.chrome.tabs) {
      return globalObject.chrome.tabs;
    }
    return undefined;
  }

  async function tryTabsCall(fn, tabId) {
    if (typeof fn !== 'function') {
      throw new Error('The provided tabs API function is not callable');
    }

    const attempts = [
      () => fn.call(null, tabId),
      () => fn.call(null, [tabId]),
      () => fn.call(null, { tabIds: [tabId] }),
      () => fn.call(null, { tabId })
    ];

    let lastError;
    for (const invoke of attempts) {
      try {
        return await invoke();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Unknown error invoking tabs API');
  }

  function didUnloadTab(result, tabId) {
    if (typeof result === 'undefined' || result === null) {
      return true;
    }
    if (Array.isArray(result)) {
      return result.some(tab => tab && tab.id === tabId);
    }
    if (typeof result === 'object') {
      if (typeof result.id === 'number') {
        return result.id === tabId;
      }
      if (Array.isArray(result.tabs)) {
        return result.tabs.some(tab => tab && tab.id === tabId);
      }
    }
    return false;
  }

  async function ensureDiscardedState(tabsApi, tabId) {
    try {
      const tab = await tabsApi.get(tabId);
      if (tab && (tab.discarded === true || tab.status === 'unloaded')) {
        return true;
      }
    } catch (_) {
      // Ignore lookup errors and fall back to discard below
    }
    return false;
  }

  async function unloadTabWithFallback(tabId) {
    const tabsApi = getTabsApi();
    if (!tabsApi) {
      throw new Error('browser.tabs API is unavailable');
    }

    let unloadError;
    if (typeof tabsApi.unload === 'function') {
      try {
        const result = await tryTabsCall(tabsApi.unload.bind(tabsApi), tabId);
        if (didUnloadTab(result, tabId)) {
          return;
        }
        if (await ensureDiscardedState(tabsApi, tabId)) {
          return;
        }
      } catch (error) {
        unloadError = error;
      }
    }

    if (typeof tabsApi.discard === 'function') {
      try {
        await tryTabsCall(tabsApi.discard.bind(tabsApi), tabId);
        return;
      } catch (discardError) {
        throw discardError;
      }
    }

    throw unloadError || new Error('Neither browser.tabs.unload nor browser.tabs.discard is available');
  }

  if (root) {
    root.unloadTabWithFallback = unloadTabWithFallback;
  }
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
