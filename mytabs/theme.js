(async function(){
  const { theme = 'light', tileWidth = 250 } = await browser.storage.local.get(['theme','tileWidth']);
  document.body.dataset.theme = theme;
  document.documentElement.style.setProperty('--tile-width', tileWidth + 'px');
})();
