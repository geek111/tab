(async function(){
  const BASE_TILE_SCALE = 0.9;
  const BASE_FONT_SCALE = 0.8125;
  const BASE_CLOSE_SCALE = 1.55;

  let { theme = 'light', tileWidth = 255, tileScale = BASE_TILE_SCALE, fontScale = BASE_FONT_SCALE, closeScale = BASE_CLOSE_SCALE, rowGap = 0, disableEffects = false } =
    await browser.storage.local.get(['theme','tileWidth','tileScale','fontScale','closeScale','rowGap','disableEffects']);
  if (closeScale === undefined) {
    closeScale = BASE_CLOSE_SCALE;
    browser.storage.local.set({ closeScale });
  }

  function apply(){
    document.body.dataset.theme = theme;
    document.body.classList.toggle('no-effects', disableEffects);
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
      if (changes.disableEffects) disableEffects = changes.disableEffects.newValue;
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

  function onZoomResetKey(e){
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key !== '0') return;
    const sameTile = tileScale === BASE_TILE_SCALE;
    const sameFont = fontScale === BASE_FONT_SCALE;
    const sameClose = closeScale === BASE_CLOSE_SCALE;
    if (sameTile && sameFont && sameClose) return;
    e.preventDefault();
    tileScale = BASE_TILE_SCALE;
    fontScale = BASE_FONT_SCALE;
    closeScale = BASE_CLOSE_SCALE;
    browser.storage.local.set({ tileScale, fontScale, closeScale });
    apply();
  }

  document.addEventListener('keydown', onZoomResetKey);
})();
