(function(global) {
  'use strict';

  function resolveGlobalTabsApi(context) {
    if (!context || !context.browser || !context.browser.tabs) {
      throw new Error('browser.tabs API is unavailable');
    }
    return context.browser.tabs;
  }

  async function hasTabBeenDiscarded(tabsApi, tabId) {
    try {
      const tab = await tabsApi.get(tabId);
      return !tab || tab.discarded === true;
    } catch (_) {
      // Treat lookup failures (e.g., tab closed) as a success case.
      return true;
    }
  }

  function isIdInArrayCandidate(candidate, tabId) {
    return Array.isArray(candidate) && candidate.includes(tabId);
  }

  async function unloadTabWithFallback(tabId) {
    const tabsApi = resolveGlobalTabsApi(global);

    let unloadError = null;
    if (typeof tabsApi.unload === 'function') {
      try {
        const result = await tabsApi.unload(tabId);
        const succeeded = await hasTabBeenDiscarded(tabsApi, tabId)
          || (result && typeof result === 'object'
            && (
              isIdInArrayCandidate(result.unloadedTabIds, tabId)
              || isIdInArrayCandidate(result.unloadedTabs, tabId)
              || (Array.isArray(result.notUnloadedTabIds) && !result.notUnloadedTabIds.includes(tabId))
            ));
        if (succeeded) {
          return result;
        }
      } catch (error) {
        unloadError = error;
      }
    }

    if (typeof tabsApi.discard === 'function') {
      return tabsApi.discard(tabId);
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
