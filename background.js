chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
    {
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: { hostEquals: 'www.primevideo.com'}
      })],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    },
    {
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: { hostEquals: 'localhost', ports: [5000]}
      })],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    },
    {
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: { hostEquals: 'clink-watch-party.herokuapp.com'}
      })],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    }

  ])
  });
});

chrome.pageAction.onClicked.addListener((tab) => {
  // Toggle Clink.
  console.log('CLICKED')
  chrome.tabs.sendMessage(tab.id, { command: 'toggle clink' });
});