browser.commands.onCommand.addListener((command) => {
  if (command === 'open-tabs-helper') {
    browser.browserAction.openPopup();
  } else if (command === 'open-tabs-helper-full') {
    browser.tabs.create({ url: browser.runtime.getURL('full.html') });
  }
});
