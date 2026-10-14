// SpringBored - Background Service Worker
// Relays messages between popup and content scripts

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SpringBored] Extension installed.');
});

// Relay messages from content script → popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STATUS_UPDATE') {
    // Broadcast to all extension views (popup)
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup may be closed — that's fine
    });
  }
  return false;
});
