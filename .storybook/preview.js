/** @type { import('@storybook/html').Preview } */
import '../css/m3-theme.css';
import '../css/style.css';

const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
