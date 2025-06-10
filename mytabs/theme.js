(async function(){
  let { theme = 'light', tileWidth = 200, tileScale = 0.9, fontScale = 0.9, closeScale = 1 } =
    await browser.storage.local.get(['theme','tileWidth','tileScale','fontScale','closeScale']);
  if (closeScale === undefined) {
    closeScale = 1;
    browser.storage.local.set({ closeScale });
  }

  function apply(){
    document.body.dataset.theme = theme;
    const width = tileWidth * tileScale;
    document.documentElement.style.setProperty('--tile-width', width + 'px');
    document.documentElement.style.setProperty('--tile-scale', tileScale);
    document.documentElement.style.setProperty('--font-scale', fontScale);
    document.documentElement.style.setProperty('--close-scale', closeScale);
    if (document.body.classList.contains('full')) {
      document.body.style.removeProperty('width');
    }
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
})();
