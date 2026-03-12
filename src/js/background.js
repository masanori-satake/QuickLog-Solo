/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 */

// アイコンクリック時にサイドパネルを開くように設定 (Chrome/Edge用)
function setSidePanelBehavior() {
  if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
}

// 初期化時および起動時に実行
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled.addListener(() => {
    setSidePanelBehavior();
  });

  chrome.runtime.onStartup.addListener(() => {
    setSidePanelBehavior();
  });
}

// トップレベルでも実行（サービスワーカーの起動時）
setSidePanelBehavior();

// フォールバック: chrome.action.onClicked を使用して明示的に開く
if (typeof chrome !== 'undefined' && chrome.action && chrome.sidePanel && chrome.sidePanel.open) {
  chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId })
      .catch((error) => console.error(error));
  });
}
