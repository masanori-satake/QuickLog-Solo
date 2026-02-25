export default {
  title: 'Components/Modals',
};

export const Settings = {
  render: () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div id="settings-popup" class="modal">
          <div class="modal-content">
              <span class="close-btn">&times;</span>
              <h2>設定</h2>

              <div class="tabs">
                  <button class="tab-btn active" data-tab="general">
                      <span class="tab-text">一般</span><span class="tab-icon">⚙️</span>
                  </button>
                  <button class="tab-btn" data-tab="categories">
                      <span class="tab-text">カテゴリ</span><span class="tab-icon">📂</span>
                  </button>
                  <button class="tab-btn" data-tab="maintenance">
                      <span class="tab-text">メンテナンス</span><span class="tab-icon">🛠️</span>
                  </button>
                  <button class="tab-btn" data-tab="about">
                      <span class="tab-text">About</span><span class="tab-icon">ℹ️</span>
                  </button>
              </div>

              <div id="general-tab" class="tab-content">
                  <div class="setting-item">
                      <label>テーマ</label>
                      <select id="theme-select">
                          <option value="system">システム設定に従う</option>
                          <option value="light">ライトモード</option>
                          <option value="dark">ダークモード</option>
                      </select>
                  </div>
                  <div class="setting-item">
                      <label>アクセントカラー</label>
                      <div id="accent-colors">
                          <button class="accent-dot blue active" data-accent="blue"></button>
                          <button class="accent-dot green" data-accent="green"></button>
                          <button class="accent-dot orange" data-accent="orange"></button>
                          <button class="accent-dot red" data-accent="red"></button>
                      </div>
                  </div>
                  <div class="setting-item">
                      <button id="export-csv-btn">CSVエクスポート</button>
                      <button id="import-csv-btn">CSVインポート</button>
                  </div>
              </div>
          </div>
      </div>
    `;
    return container;
  },
};

export const Confirm = {
  render: () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div id="confirm-modal" class="modal">
          <div class="modal-content">
              <p id="confirm-message">本当に作業を終了しますか？</p>
              <div class="confirm-btns">
                  <button id="confirm-cancel-btn">キャンセル</button>
                  <button id="confirm-ok-btn">OK</button>
              </div>
          </div>
      </div>
    `;
    return container;
  },
};
