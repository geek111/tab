chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-tabs-helper') {
    chrome.browserAction.openPopup();
  }
});
