(async function(){
  let { theme = 'light', tileWidth = 200, tileScale = 0.9, fontScale = 0.9 } = await browser.storage.local.get(['theme','tileWidth','tileScale','fontScale']);

  function apply(){
    document.body.dataset.theme = theme;
    const width = tileWidth * tileScale;
    document.documentElement.style.setProperty('--tile-width', width + 'px');
    document.documentElement.style.setProperty('--tile-scale', tileScale);
    document.documentElement.style.setProperty('--font-scale', fontScale);
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
      apply();
    }
  });
})();
