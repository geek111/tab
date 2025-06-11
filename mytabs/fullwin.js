(async function(){
  const { fullSize } = await browser.storage.local.get('fullSize');
  if (fullSize && typeof fullSize.width === 'number' && typeof fullSize.height === 'number') {
    try {
      window.resizeTo(fullSize.width, fullSize.height);
      if (typeof fullSize.left === 'number' && typeof fullSize.top === 'number') {
        window.moveTo(fullSize.left, fullSize.top);
      }
    } catch (_) {}
  }

  window.addEventListener('unload', () => {
    const data = {
      width: window.outerWidth,
      height: window.outerHeight,
      left: window.screenX,
      top: window.screenY
    };
    browser.storage.local.set({ fullSize: data });
  });

  // tile width based on theme settings only

  // layout handled via CSS columns
})();
