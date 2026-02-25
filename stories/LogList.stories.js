export default {
  title: 'Components/LogList',
};

const createLogItem = (startTime, endTime, category, colorClass, isManualStop = false) => {
    const li = document.createElement('li');
    li.className = 'log-item';

    let timeRangeHtml;
    if (isManualStop) {
        timeRangeHtml = `<span class="log-time"><span style="visibility:hidden">${startTime}</span>-${endTime}</span>`;
    } else if (endTime) {
        timeRangeHtml = `<span class="log-time">${startTime}-${endTime}</span>`;
    } else {
        timeRangeHtml = `<span class="log-time">${startTime}-<span style="visibility:hidden">${startTime}</span></span>`;
    }

    li.innerHTML = `
        ${timeRangeHtml}
        <span class="log-name"><span class="category-dot ${colorClass}"></span>${category}</span>
        <span class="log-duration">${endTime ? '25m' : ''}</span>
    `;
    return li;
};

export const Default = {
  render: () => {
    const ul = document.createElement('ul');
    ul.id = 'log-list';
    ul.style.width = '350px';
    ul.style.listStyle = 'none';
    ul.style.padding = '0';

    const header = document.createElement('li');
    header.className = 'log-date-header';
    header.textContent = '2026/02/25 (水)';
    ul.appendChild(header);

    ul.appendChild(createLogItem('10:00', '10:25', 'Coding', 'dot-blue'));
    ul.appendChild(createLogItem('10:25', '10:50', 'Meeting', 'dot-green'));
    ul.appendChild(createLogItem('10:50', '', 'Lunch', 'dot-orange'));

    return ul;
  },
};
