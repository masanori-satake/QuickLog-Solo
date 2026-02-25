export default {
  title: 'Example/Button',
  argTypes: {
    label: { control: 'text' },
  },
};

export const Primary = {
  render: (args) => {
    const btn = document.createElement('button');
    btn.innerText = args.label;
    return btn;
  },
  args: {
    label: 'Button',
  },
};
