let poller;
function startPolling() {
  async function fetchState() {
    try {
      const res = await browser.runtime.sendMessage({ type: 'getTabState' });
      if (res) {
        if (Array.isArray(res.visited)) {
          visitedIds = new Set(res.visited);
        }
        if (Array.isArray(res.tabs)) {
          backgroundTabs = res.tabs;
        }
        scheduleUpdate();
      }
    } catch (e) {}
  }
  fetchState();
  poller = setInterval(fetchState, 5000);
}

document.addEventListener('DOMContentLoaded', startPolling);
window.addEventListener('unload', () => {
  if (poller) clearInterval(poller);
});
