(async function(){
  let { theme = 'light', tileWidth = 100, tileScale = 0.9, fontScale = 0.45, closeScale = 0.5 } =
    await browser.storage.local.get(['theme','tileWidth','tileScale','fontScale','closeScale']);
  if (closeScale === undefined) {
    closeScale = 0.5;
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
