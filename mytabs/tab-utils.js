(function(global) {
  'use strict';

  async function unloadTabWithFallback(tabId) {
    const tabsApi = global && global.browser && global.browser.tabs;
    if (!tabsApi) {
      throw new Error('browser.tabs API is unavailable');
    }

    if (typeof tabsApi.unload === 'function') {
      const maybeArgumentError = (error) => {
        if (!error) return false;
        if (error.name === 'TypeError') return true;
        const message = String(error.message || error);
        return /tabIds|arguments|requires/i.test(message);
      };

      const isUnsupportedError = (error) => {
        if (!error) return false;
        const message = String(error.message || error);
        return /unavailable|not supported|not implemented|unsupported/i.test(message);
      };

      const callVariants = [
        () => tabsApi.unload(tabId),
        () => tabsApi.unload([tabId])
      ];

      for (let i = 0; i < callVariants.length; i++) {
        try {
          return await callVariants[i]();
        } catch (error) {
          if (i < callVariants.length - 1 && maybeArgumentError(error)) {
            continue;
          }
          if (isUnsupportedError(error)) {
            break;
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
