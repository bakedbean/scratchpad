// Listen for clicks on the browser action icon
browser.browserAction.onClicked.addListener(() => {
  // Open scratchpad in a new tab
  browser.tabs.create({
    url: browser.runtime.getURL("scratchpad.html")
  });
});
