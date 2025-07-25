document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('ext-version');
  if (el && (typeof browser !== 'undefined')) {
    el.textContent = browser.runtime.getManifest().version;
  } else if (el && (typeof chrome !== 'undefined')) {
    el.textContent = chrome.runtime.getManifest().version;
  }
});
