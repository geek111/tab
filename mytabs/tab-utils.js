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

    const tabLooksUnloaded = async (result) => {
      if (Array.isArray(result)) {
        if (result.includes(tabId)) {
          return true;
        }
      } else if (result && typeof result === 'object') {
        if (result.discarded || result.status === 'unloaded' || result.unloaded === true) {
          return true;
        }
      }

      let tabInfo = await ensureTabInfo();
      if (!tabInfo || tabInfo.discarded || tabInfo.status === 'unloaded' || tabInfo.unloaded) {
        return true;
      }

      // Give Firefox time to update the tab state when unload succeeds lazily.
      await new Promise(resolve => setTimeout(resolve, 100));
      tabInfo = await ensureTabInfo();
      return !tabInfo || tabInfo.discarded || tabInfo.status === 'unloaded' || tabInfo.unloaded;
    };

    if (typeof tabsApi.unload === 'function') {
      const maybeArgumentError = (error) => {
        if (!error) return false;
        if (error.name === 'TypeError') return true;
        const message = String(error.message || error);
        return /tabIds|arguments|requires|object/i.test(message);
      };

      const callVariants = [
        () => tabsApi.unload(tabId),
        () => tabsApi.unload([tabId]),
        () => tabsApi.unload({ tabId }),
        () => tabsApi.unload({ tabIds: [tabId] })
      ];

      for (let i = 0; i < callVariants.length; i++) {
        try {
          const result = await callVariants[i]();
          if (await tabLooksUnloaded(result)) {
            return result;
          }
          if (i < callVariants.length - 1) {
            continue;
          }
          break;
        } catch (error) {
          if (i < callVariants.length - 1 && maybeArgumentError(error)) {
            continue;
          }
          // Fall back to discard below if unload fails (e.g., unsupported tab state)
          break;
        }
      }
    }

    if (typeof tabsApi.discard === 'function') {
      return tabsApi.discard(tabId);
    }

    throw new Error('Neither browser.tabs.unload nor browser.tabs.discard is available');
  }

  if (typeof global !== 'undefined') {
    global.unloadTabWithFallback = unloadTabWithFallback;
  }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
