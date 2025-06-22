const GROUPS_KEY = 'kepiGroups';

let groups = [];

async function loadGroups() {
  const data = await browser.storage.local.get(GROUPS_KEY);
  groups = data[GROUPS_KEY] || [];
}

async function saveGroups() {
  await browser.storage.local.set({ [GROUPS_KEY]: groups });
  try {
    await browser.storage.sync.set({ [GROUPS_KEY]: groups });
  } catch (_) {
    // ignore sync errors (e.g. permissions)
  }
}

function createGroup(name, color = '#888888') {
  const id = Date.now().toString(36);
  const group = { id, name, color, tabs: [] };
  groups.push(group);
  saveGroups();
  return group;
}

function updateGroup(id, props) {
  const g = groups.find(gr => gr.id === id);
  if (!g) return;
  Object.assign(g, props);
  saveGroups();
}

function removeGroup(id) {
  groups = groups.filter(g => g.id !== id);
  saveGroups();
}

function assignTabToGroup(tabId, groupId) {
  const g = groups.find(gr => gr.id === groupId);
  if (!g) return;
  if (!g.tabs.includes(tabId)) {
    g.tabs.push(tabId);
    saveGroups();
  }
}

function removeTabFromGroup(tabId, groupId) {
  const g = groups.find(gr => gr.id === groupId);
  if (!g) return;
  g.tabs = g.tabs.filter(id => id !== tabId);
  saveGroups();
}

loadGroups();

this.kepiGroups = {
  get groups() { return groups; },
  createGroup,
  updateGroup,
  removeGroup,
  assignTabToGroup,
  removeTabFromGroup,
  saveGroups,
  loadGroups
};
