async function setColumns() {
  const { cols = 3 } = await browser.storage.local.get('cols');
  const minWidth = 250;
  const computed = Math.max(1, Math.min(cols, Math.floor(window.innerWidth / minWidth)));
  document.documentElement.style.setProperty('--cols', computed);
}

setColumns();
window.addEventListener('resize', setColumns);
