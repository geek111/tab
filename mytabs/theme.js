(async function(){
  let { theme = 'light', tileWidth = 255, tileScale = 0.9, fontScale = 0.8125, closeScale = 1.55, rowGap = 0 } =
    await browser.storage.local.get(['theme','tileWidth','tileScale','fontScale','closeScale','rowGap']);
  if (closeScale === undefined) {
    closeScale = 1.55;
    browser.storage.local.set({ closeScale });
  }

  function apply(){
    document.body.dataset.theme = theme;
    const width = tileWidth * tileScale;
    document.documentElement.style.setProperty('--tile-width', width + 'px');
    const isPopup = document.body.classList.contains('popup');
    const scale = isPopup ? tileScale * 0.8 : tileScale;
    const font = isPopup ? fontScale * 0.85 : fontScale;
    document.documentElement.style.setProperty('--tile-scale', scale);
    document.documentElement.style.setProperty('--font-scale', font);
    document.documentElement.style.setProperty('--close-scale', closeScale);
    document.documentElement.style.setProperty('--row-gap', rowGap + 'em');
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
      if (changes.rowGap) rowGap = changes.rowGap.newValue;
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
    const newClose = Math.min(2, Math.max(0.25, closeScale + step));
    if (
      newTile === tileScale &&
      newFont === fontScale &&
      newClose === closeScale
    ) return;
    tileScale = newTile;
    fontScale = newFont;
    closeScale = newClose;
    browser.storage.local.set({ tileScale, fontScale, closeScale });
    apply();
  }

  document.addEventListener('wheel', onZoomWheel, { passive: false });

  function showBody(){
    document.body.classList.add('fade-show');
  }

  document.addEventListener('DOMContentLoaded', showBody);
  if (document.readyState !== 'loading') {
    showBody();
  }
})();
