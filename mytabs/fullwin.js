(async function(){
  const { fullSize, tileWidth = 250, tileScale = 1 } =
    await browser.storage.local.get(['fullSize', 'tileWidth', 'tileScale']);
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

  function updateCols() {
    const style = getComputedStyle(document.documentElement);
    const tile = parseInt(style.getPropertyValue('--tile-width'), 10) || 250;
    const width = document.body.clientWidth;
    const cols = Math.max(1, Math.floor(width / tile));
    document.documentElement.style.setProperty('--cols', cols);
  }


  window.addEventListener('resize', updateCols);
  updateCols();
})();
