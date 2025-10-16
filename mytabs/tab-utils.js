(function(global) {
  'use strict';

  async function unloadTabWithFallback(tabId) {
    const tabsApi = global && global.browser && global.browser.tabs;
    if (!tabsApi) {
      throw new Error('browser.tabs API is unavailable');
    }

    const ensureTabInfo = async () => {
      try {
        return await tabsApi.get(tabId);
      } catch (_) {
        return null;
      }
    };

    const resultIndicatesUnload = (result) => {
      if (!result) return false;
      if (Array.isArray(result)) {
        return result.includes(tabId);
      }
      if (typeof result === 'object') {
        if (typeof result.succeeded === 'boolean') {
          return result.succeeded;
        }
        if (Array.isArray(result.tabIds)) {
          return result.tabIds.includes(tabId);
        }
        if (result.discarded || result.status === 'unloaded') {
          return true;
        }
      }
      return false;
    };

    const waitForUnloadState = async () => {
      const maxAttempts = 10;
      const wait = () => new Promise(resolve => setTimeout(resolve, 100));
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const tabInfo = await ensureTabInfo();
        if (!tabInfo || tabInfo.discarded || tabInfo.status === 'unloaded') {
          return true;
        }
        await wait();
      }
      return false;
    };

    if (typeof tabsApi.unload === 'function') {
      const maybeArgumentError = (error) => {
        if (!error) return false;
        if (error.name === 'TypeError') return true;
        const message = String(error.message || error);
        return /tabIds|arguments|requires/i.test(message);
      };

      const callVariants = [
        () => tabsApi.unload({ tabIds: [tabId] }),
        () => tabsApi.unload([tabId]),
        () => tabsApi.unload(tabId)
      ];

      for (let i = 0; i < callVariants.length; i++) {
        try {
          const result = await callVariants[i]();
          if (resultIndicatesUnload(result) || await waitForUnloadState()) {
            return result;
          }
          if (i < callVariants.length - 1) {
            continue;
          }
        } catch (error) {
          if (i < callVariants.length - 1 && maybeArgumentError(error)) {
            continue;
          }
        }
        break;
      }
    }

    if (typeof tabsApi.discard === 'function') {
      const result = await tabsApi.discard(tabId);
      if (resultIndicatesUnload(result)) {
        return result;
      }
      await waitForUnloadState();
      return result;
    }

    throw new Error('Neither browser.tabs.unload nor browser.tabs.discard is available');
  }

  if (typeof global !== 'undefined') {
    global.unloadTabWithFallback = unloadTabWithFallback;
  }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
