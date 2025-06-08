async function setColumns() {
  // Determine columns purely from window width so the grid
  // automatically expands to fill the available space.
  const minWidth = 250;
  const computed = Math.max(1, Math.floor(window.innerWidth / minWidth));
  document.documentElement.style.setProperty('--cols', computed);
}

setColumns();
window.addEventListener('resize', setColumns);
