async function load(){
  const {theme='light', cols=3} = await browser.storage.local.get(['theme','cols']);
  document.getElementById('theme').value = theme;
  document.getElementById('cols').value = cols;
}
async function save(){
  const theme=document.getElementById('theme').value;
  const cols=parseInt(document.getElementById('cols').value,10);
  await browser.storage.local.set({theme, cols});
}
document.getElementById('save').addEventListener('click', save);
load();
