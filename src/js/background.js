/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 */

// アイコンクリック時にサイドパネルを開くように設定 (Chrome/Edge用)
if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
}
