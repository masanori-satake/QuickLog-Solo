export default {
  title: 'Components/Header',
};

export const Default = {
  render: () => {
    const header = document.createElement('header');
    header.innerHTML = `
      <div id="header-btns">
          <button id="copy-report-btn" title="日報コピー">📋</button>
          <button id="copy-aggregation-btn" title="集計コピー">📊</button>
          <button id="pip-toggle" title="常に前面に表示">📌</button>
          <button id="settings-toggle" title="設定">⚙️</button>
          <button id="layout-toggle" title="レイアウト切替">↕️</button>
      </div>
    `;
    return header;
  },
};
