(async function(){
  const { theme = 'light', tileWidth = 250, cols = 3 } = await browser.storage.local.get(['theme','tileWidth','cols']);
  document.body.dataset.theme = theme;
  document.documentElement.style.setProperty('--tile-width', tileWidth + 'px');
  document.documentElement.style.setProperty('--cols', cols);
})();
