/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 */

// アイコンクリック時にサイドパネルを開くように設定
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
