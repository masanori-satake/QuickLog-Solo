module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {},
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.spec\\.js$'
  ],
};
