export default {
  title: 'Components/TimerDisplay',
  argTypes: {
    taskName: { control: 'text' },
    elapsed: { control: 'text' },
    status: { control: 'select', options: ['▶', '⏸', '⏹'] },
    color: { control: 'select', options: ['blue', 'green', 'orange', 'red', 'purple', 'teal', 'gray', 'idle'] },
    progress: { control: { type: 'range', min: 0, max: 100 } },
  },
};

export const Running = {
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '300px';
    container.innerHTML = `
      <div id="current-task-display" class="cat-${args.color}">
          <div id="current-task-display-base">
              <h2 id="current-task-name">${args.taskName}</h2>
              <div class="timer-box">
                  <span id="status-label">${args.status}</span>
                  <div id="elapsed-time">${args.elapsed}</div>
              </div>
          </div>

          <div id="current-task-display-overlay" class="cat-${args.color}-full" style="clip-path: inset(0 ${100 - args.progress}% 0 0);">
              <h2 id="current-task-name-overlay">${args.taskName}</h2>
              <div class="timer-box">
                  <span id="status-label-overlay">${args.status}</span>
                  <div id="elapsed-time-overlay">${args.elapsed}</div>
              </div>
          </div>
      </div>
    `;
    return container;
  },
  args: {
    taskName: 'Coding',
    elapsed: '00:12:34',
    status: '▶',
    color: 'blue',
    progress: 45,
  },
};

export const Paused = {
  ...Running,
  args: {
    ...Running.args,
    status: '⏸',
    progress: 0,
  },
};

export const Stopped = {
  ...Running,
  args: {
    taskName: '-',
    elapsed: '00:00:00',
    status: '⏹',
    color: 'idle',
    progress: 0,
  },
};
