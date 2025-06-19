(async function(){
  let { theme = 'light', tileWidth = 150, tileScale = 0.9, fontScale = 0.8125, closeScale = 0.5 } =
    await browser.storage.local.get(['theme','tileWidth','tileScale','fontScale','closeScale']);
  if (closeScale === undefined) {
    closeScale = 0.5;
    browser.storage.local.set({ closeScale });
  }

  function apply(){
    document.body.dataset.theme = theme;
    const width = tileWidth * tileScale;
    document.documentElement.style.setProperty('--tile-width', width + 'px');
    const isPopup = document.body.classList.contains('popup');
    const scale = isPopup ? tileScale * 0.8 : tileScale;
    const font = isPopup ? fontScale * 0.85 : fontScale;
    document.documentElement.style.setProperty('--ui-scale', scale);
    document.documentElement.style.setProperty('--tile-scale', scale);
    document.documentElement.style.setProperty('--font-scale', font);
    document.documentElement.style.setProperty('--close-scale', closeScale);
    if (document.body.classList.contains('full')) {
      document.body.style.removeProperty('width');
    }
    window.dispatchEvent(new Event('theme-applied'));
  }

  apply();

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.theme) theme = changes.theme.newValue;
      if (changes.tileWidth) tileWidth = changes.tileWidth.newValue;
      if (changes.tileScale) tileScale = changes.tileScale.newValue;
      if (changes.fontScale) fontScale = changes.fontScale.newValue;
      if (changes.closeScale) closeScale = changes.closeScale.newValue;
      apply();
    }
  });

  function onZoomWheel(e){
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY || e.deltaX;
    const step = delta < 0 ? 0.1 : -0.1;
    const newTile = Math.min(2, Math.max(0.5, tileScale + step));
    const newFont = Math.min(2, Math.max(0.5, fontScale + step));
    if (newTile === tileScale && newFont === fontScale) return;
    tileScale = newTile;
    fontScale = newFont;
    browser.storage.local.set({ tileScale, fontScale });
    apply();
  }

  document.addEventListener('wheel', onZoomWheel, { passive: false });
})();
