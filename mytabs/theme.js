(async function(){
  let { theme = 'light', tileWidth = 250, cols = 3 } = await browser.storage.local.get(['theme','tileWidth','cols']);

  function apply(){
    document.body.dataset.theme = theme;
    document.documentElement.style.setProperty('--tile-width', tileWidth + 'px');
    document.documentElement.style.setProperty('--cols', cols);
    if (document.body.classList.contains('full')) {
      document.body.style.removeProperty('width');
    }
  }

  apply();

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.theme) theme = changes.theme.newValue;
      if (changes.tileWidth) tileWidth = changes.tileWidth.newValue;
      if (changes.cols) cols = changes.cols.newValue;
      apply();
    }
  });
})();
