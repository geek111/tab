(async function(){
  const { theme = 'light' } = await browser.storage.local.get('theme');
  document.body.dataset.theme = theme;
})();
