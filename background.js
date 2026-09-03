const MENU_ID = 'qbhc-add-link';
const PRODUCT_NAME = 'QBitTorrent HomeConnect';

function installMenu() {
  chrome.contextMenus.removeAll().then(() => chrome.contextMenus.create({
    id: MENU_ID,
    title: `Add to ${PRODUCT_NAME}`,
    contexts: ['link']
  })).catch(() => {});
}

chrome.runtime.onInstalled.addListener(installMenu);
chrome.runtime.onStartup.addListener(installMenu);

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.linkUrl) return;
  await chrome.storage.local.set({ pendingAddUrl: info.linkUrl });
  try { await chrome.action.openPopup(); } catch (_) {}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'get-pending-add') return;
  chrome.storage.local.get('pendingAddUrl').then(async (data) => {
    const url = data?.pendingAddUrl || '';
    if (url) await chrome.storage.local.remove('pendingAddUrl');
    sendResponse({ url });
  }).catch(() => sendResponse({ url: '' }));
  return true;
});
