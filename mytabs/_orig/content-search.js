(function(){
  browser.runtime.onMessage.addListener((msg) => {
    if(msg && msg.type === 'highlight' && msg.query){
      const sel = window.getSelection();
      sel.removeAllRanges();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node;
      while((node = walker.nextNode())){
        const idx = node.textContent.toLowerCase().indexOf(msg.query.toLowerCase());
        if(idx !== -1){
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + msg.query.length);
          sel.addRange(range);
          break;
        }
      }
    }
  });
})();
