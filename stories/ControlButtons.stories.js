export default {
  title: 'Components/ControlButtons',
  argTypes: {
    pauseDisabled: { control: 'boolean' },
    endDisabled: { control: 'boolean' },
    pauseLabel: { control: 'text' },
  },
};

export const Default = {
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '300px';
    container.innerHTML = `
      <div id="stop-btn-box">
          <button id="pause-btn" ${args.pauseDisabled ? 'disabled' : ''}>
              <span class="btn-text">${args.pauseLabel}</span><span class="btn-icon">⏸️</span>
          </button>
          <button id="end-btn" ${args.endDisabled ? 'disabled' : ''}>
              <span class="btn-text">終了</span><span class="btn-icon">⏹️</span>
          </button>
      </div>
    `;
    return container;
  },
  args: {
    pauseDisabled: false,
    endDisabled: false,
    pauseLabel: '一時停止',
  },
};

export const Disabled = {
  ...Default,
  args: {
    pauseDisabled: true,
    endDisabled: true,
    pauseLabel: '一時停止',
  },
};
