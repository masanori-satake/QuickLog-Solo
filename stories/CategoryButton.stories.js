export default {
  title: 'Components/CategoryButton',
  argTypes: {
    name: { control: 'text' },
    color: { control: 'select', options: ['blue', 'green', 'orange', 'red', 'purple', 'teal', 'gray', 'idle'] },
    active: { control: 'boolean' },
  },
};

export const Default = {
  render: (args) => {
    const btn = document.createElement('button');
    btn.className = `category-btn cat-${args.color}`;
    if (args.active) btn.classList.add('active');
    btn.textContent = args.name;
    return btn;
  },
  args: {
    name: 'Development',
    color: 'blue',
    active: false,
  },
};

export const Active = {
  ...Default,
  args: {
    ...Default.args,
    active: true,
  },
};

export const Grid = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = '1fr 1fr';
    container.style.gap = '8px';
    container.style.width = '300px';

    const colors = ['blue', 'green', 'orange', 'red', 'purple', 'teal', 'gray', 'idle'];
    colors.forEach(color => {
      const btn = document.createElement('button');
      btn.className = `category-btn cat-${color}`;
      btn.textContent = color.charAt(0).toUpperCase() + color.slice(1);
      container.appendChild(btn);
    });
    return container;
  }
};
