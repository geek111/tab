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

  function applyTileWidth() {
    const width = Math.max(window.innerWidth / 5, 150);
    document.documentElement.style.setProperty('--tile-width', width + 'px');
  }

  applyTileWidth();
  window.addEventListener('theme-applied', applyTileWidth);
  window.addEventListener('resize', applyTileWidth);

  // layout now handled purely via CSS grid
})();
