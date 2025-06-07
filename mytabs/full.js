async function load(){
  const {cols=3} = await browser.storage.local.get('cols');
  document.documentElement.style.setProperty('--cols', cols);
  const tabs = await browser.tabs.query({});
  const grid = document.getElementById('grid');
  for(const t of tabs){
    const c=document.createElement('div');
    c.className='cell';
    c.textContent=t.title||t.url;
    c.onclick=()=>browser.tabs.update(t.id,{active:true});
    grid.appendChild(c);
  }
}
load();
