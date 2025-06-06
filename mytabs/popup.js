async function getTabs() {
  const tabs = await browser.tabs.query({});
  return tabs;
}

function createTabRow(tab, isDuplicate) {
  const div = document.createElement('div');
  div.className = 'tab';
  if (isDuplicate) {
    div.style.backgroundColor = '#fdd';
  }

  const title = document.createElement('span');
  title.textContent = tab.title || tab.url;
  title.className = 'tab-title';
  div.appendChild(title);

  const btnActivate = document.createElement('button');
  btnActivate.textContent = 'Activate';
  btnActivate.onclick = () => browser.tabs.update(tab.id, {active: true});
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

function renderTabs(tabs) {
  const duplicates = findDuplicates(tabs);
  const dupIds = new Set(duplicates.map(t => t.id));

  const container = document.getElementById('tabs');
  container.innerHTML = '';
  for (const tab of tabs) {
    const row = createTabRow(tab, dupIds.has(tab.id));
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
  const searchInput = document.getElementById('search');
  const query = searchInput.value.trim();
  if (query) {
    tabs = filterTabs(tabs, query);
  }
  renderTabs(tabs);
}

document.getElementById('search').addEventListener('input', update);

document.addEventListener('DOMContentLoaded', update);
