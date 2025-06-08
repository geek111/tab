async function load() {
  const { cols = 3 } = await browser.storage.local.get('cols');
  document.documentElement.style.setProperty('--cols', cols);
}
load();
