// Static content scripts cover new navigations. Also mount the button in tabs
// that were already open when the extension was installed or reloaded.
async function mountInOpenTabs() {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.allSettled(tabs.filter((tab) => Number.isInteger(tab.id)).map((tab) =>
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] })
  ));
  // Chrome-protected pages (including the Web Store) reject injection. A failed
  // tab must not prevent mounting the button in the other tabs.
}

chrome.runtime.onInstalled.addListener(() => {
  mountInOpenTabs().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  mountInOpenTabs().catch(() => {});
});
