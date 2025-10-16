(function(global) {
  'use strict';

  function hasTabBeenUnloaded(tab) {
    if (!tab || typeof tab !== 'object') {
      return false;
    }

    if (tab.discarded) {
      return true;
    }

    const { status } = tab;
    if (typeof status === 'string' && status.toLowerCase() === 'unloaded') {
      return true;
    }

    return false;
  }

  function resultImpliesUnload(value) {
    if (Array.isArray(value)) {
      return value.some(resultImpliesUnload);
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return hasTabBeenUnloaded(value);
  }

  async function unloadTabWithFallback(tabId) {
    const tabsApi = global && global.browser && global.browser.tabs;
    if (!tabsApi) {
      throw new Error('browser.tabs API is unavailable');
    }

    if (typeof tabsApi.unload === 'function') {
      try {
        const result = await tabsApi.unload(tabId);

        // Firefox may resolve with a tab-like object. If it reports the tab as
        // discarded or unloaded we can stop early.
        if (resultImpliesUnload(result)) {
          return result;
        }

        // Some Firefox versions resolve without discarding the tab (for
        // example, when the feature is behind a pref). Double-check the tab
        // state before falling back so we retain legacy behaviour.
        const ensureTabInfo = async () => {
          try {
            return await tabsApi.get(tabId);
          } catch (_) {
            return null;
          }
        };

        let tabInfo = await ensureTabInfo();
        if (!tabInfo || hasTabBeenUnloaded(tabInfo)) {
          return result;
        }

        // Give the browser a moment to update the tab state before assuming
        // the unload failed.
        await new Promise(resolve => setTimeout(resolve, 50));
        tabInfo = await ensureTabInfo();
        if (!tabInfo || hasTabBeenUnloaded(tabInfo)) {
          return result;
        }
      } catch (error) {
        // Fall back to discard below if unload fails (e.g., unsupported tab state)
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
