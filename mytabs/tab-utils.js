(function(global) {
  'use strict';

  function getTabsApi(scope) {
    if (!scope || !scope.browser || !scope.browser.tabs) {
      throw new Error('browser.tabs API is unavailable');
    }
    return scope.browser.tabs;
  }

  async function wasTabDiscarded(tabsApi, tabId, unloadResult) {
    if (Array.isArray(unloadResult)) {
      if (unloadResult.some(tab => tab && tab.id === tabId && tab.discarded)) {
        return true;
      }
      if (unloadResult.length > 0) {
        return true;
      }
    } else if (unloadResult && typeof unloadResult === 'object') {
      if (typeof unloadResult.discarded === 'boolean') {
        return unloadResult.discarded;
      }
      if (typeof unloadResult.success === 'boolean') {
        return unloadResult.success;
      }
      if (typeof unloadResult.id === 'number' && unloadResult.id === tabId) {
        return true;
      }
    }

    try {
      const tab = await tabsApi.get(tabId);
      return !tab || !!tab.discarded;
    } catch (_) {
      // If the tab can no longer be retrieved, assume it was successfully unloaded.
      return true;
    }
  }

  async function unloadTabWithFallback(tabId) {
    const tabsApi = getTabsApi(global);

    let unloadError;
    if (typeof tabsApi.unload === 'function') {
      try {
        const result = await tabsApi.unload(tabId);
        if (await wasTabDiscarded(tabsApi, tabId, result)) {
          return;
        }
      } catch (error) {
        unloadError = error;
      }
    }

    if (typeof tabsApi.discard === 'function') {
      try {
        await tabsApi.discard(tabId);
        return;
      } catch (discardError) {
        if (unloadError) {
          discardError.previousError = unloadError;
        }
        throw discardError;
      }
    }

    if (unloadError) {
      throw unloadError;
    }

    throw new Error('Neither browser.tabs.unload nor browser.tabs.discard is available');
  }

  if (typeof global !== 'undefined') {
    global.unloadTabWithFallback = unloadTabWithFallback;
  }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
