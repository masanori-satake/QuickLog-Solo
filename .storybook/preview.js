/** @type { import('@storybook/html').Preview } */
import '../src/css/m3-theme.css';
import '../src/css/style.css';

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
