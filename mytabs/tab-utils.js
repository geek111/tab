(function(global) {
  'use strict';

  async function unloadTabWithFallback(tabId) {
    const tabsApi = global && global.browser && global.browser.tabs;
    if (!tabsApi) {
      throw new Error('browser.tabs API is unavailable');
    }

    const waitForUnloadState = async () => {
      const maxAttempts = 5;
      const delay = 100;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let tabInfo = null;
        try {
          tabInfo = await tabsApi.get(tabId);
        } catch (_) {
          return true;
        }

        if (!tabInfo) {
          return true;
        }

        if (tabInfo.discarded || tabInfo.status === 'unloaded' || tabInfo.unloaded === true) {
          return true;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      return false;
    };

    const maybeArgumentError = (error) => {
      if (!error) {
        return false;
      }
      if (error.name === 'TypeError') {
        return true;
      }
      const message = String(error.message || error);
      return /tabIds|arguments|requires|is not iterable|sequence/i.test(message);
    };

    const maybeUnsupportedError = (error) => {
      if (!error) {
        return false;
      }
      const message = String(error.message || error);
      return /not implemented|not supported|unsupported|no such function/i.test(message);
    };

    let unloadAttempted = false;
    let lastError = null;

    if (typeof tabsApi.unload === 'function') {
      const callVariants = [
        () => tabsApi.unload(tabId),
        () => tabsApi.unload([tabId]),
        () => tabsApi.unload({ tabIds: [tabId] })
      ];

      for (let i = 0; i < callVariants.length; i++) {
        try {
          unloadAttempted = true;
          const result = await callVariants[i]();
          if (await waitForUnloadState()) {
            return result;
          }
        } catch (error) {
          lastError = error;
          if (maybeArgumentError(error) && i < callVariants.length - 1) {
            continue;
          }
          if (maybeUnsupportedError(error)) {
            break;
          }
          // For other failures keep lastError for potential reporting below.
          break;
        }
      }
    }

    if (typeof tabsApi.discard === 'function') {
      return tabsApi.discard(tabId);
    }

    if (lastError && unloadAttempted) {
      throw lastError;
    }

    throw new Error('Neither browser.tabs.unload nor browser.tabs.discard is available');
  }

  if (typeof global !== 'undefined') {
    global.unloadTabWithFallback = unloadTabWithFallback;
  }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
