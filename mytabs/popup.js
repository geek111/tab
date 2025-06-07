async function getTabs() {
  const tabs = await browser.tabs.query({});
  return tabs;
}

function closeUI() {
  if (browser.sidebarAction) {
    try { browser.sidebarAction.close(); } catch (e) {}
  }
  window.close();
}

async function activateTab(id) {
  try {
    await browser.tabs.update(id, {active: true});
    closeUI();
  } catch (e) {
    document.getElementById('error').textContent = 'Could not activate tab';
    document.querySelector(`[data-tab="${id}"]`)?.remove();
  }
}

function createTabRow(tab, isDuplicate, activeId) {
  const div = document.createElement('div');
  div.className = 'tab';
  div.dataset.tab = tab.id;
  div.tabIndex = 0;
  if (tab.id === activeId) {
    div.classList.add('active');
  }
  if (isDuplicate) {
    div.style.backgroundColor = '#fdd';
  }

  div.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    activateTab(tab.id);
  });

  div.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      activateTab(tab.id);
    }
  });

  const title = document.createElement('span');
  title.textContent = tab.title || tab.url;
  title.className = 'tab-title';
  div.appendChild(title);

  const btnActivate = document.createElement('button');
  btnActivate.textContent = 'Activate';
  btnActivate.onclick = () => activateTab(tab.id);
  div.appendChild(btnActivate);

  const btnUnload = document.createElement('button');
  btnUnload.textContent = 'Unload';
  btnUnload.onclick = () => browser.tabs.discard(tab.id);
  div.appendChild(btnUnload);

  const btnClose = document.createElement('button');
  btnClose.textContent = 'Close';
  btnClose.onclick = () => browser.tabs.remove(tab.id);
  div.appendChild(btnClose);

  const btnMove = document.createElement('button');
  btnMove.textContent = 'Move';
  btnMove.onclick = async () => {
    const windows = await browser.windows.getAll({populate: false});
    const other = windows.find(w => w.id !== tab.windowId);
    if (other) {
      await browser.tabs.move(tab.id, {windowId: other.id, index: -1});
    }
  };
  div.appendChild(btnMove);

  return div;
}

function renderTabs(tabs, activeId) {
  const duplicates = findDuplicates(tabs);
  const dupIds = new Set(duplicates.map(t => t.id));

  const container = document.getElementById('tabs');
  container.innerHTML = '';
  for (const tab of tabs) {
    const row = createTabRow(tab, dupIds.has(tab.id), activeId);
    container.appendChild(row);
  }
}

function filterTabs(tabs, query) {
  const q = query.toLowerCase();
  return tabs.filter(t => (t.title && t.title.toLowerCase().includes(q)) ||
                         (t.url && t.url.toLowerCase().includes(q)));
}

function findDuplicates(tabs) {
  const map = new Map();
  const duplicates = [];
  for (const tab of tabs) {
    if (map.has(tab.url)) {
      duplicates.push(tab);
    } else {
      map.set(tab.url, tab);
    }
  }
  return duplicates;
}

async function update() {
  let tabs = await getTabs();
  const current = await browser.tabs.query({currentWindow: true, active: true});
  const activeId = current.length ? current[0].id : -1;
  const searchInput = document.getElementById('search');
  const query = searchInput.value.trim();
  if (query) {
    tabs = filterTabs(tabs, query);
  }
  renderTabs(tabs, activeId);
}

document.getElementById('search').addEventListener('input', update);

document.addEventListener('keydown', (e) => {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  if (!tabs.length) return;
  if (document.activeElement.tagName === 'INPUT') return;
  let idx = tabs.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    idx = (idx + 1) % tabs.length;
    tabs[idx].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    idx = (idx - 1 + tabs.length) % tabs.length;
    tabs[idx].focus();
  } else if (e.key === 'Enter' && document.activeElement.classList.contains('tab')) {
    document.activeElement.click();
  }
});

document.addEventListener('DOMContentLoaded', update);
