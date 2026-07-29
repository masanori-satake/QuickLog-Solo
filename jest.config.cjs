module.exports = {
    testEnvironment: 'jsdom',
    setupFiles: ['<rootDir>/jest.setup.cjs'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {},
    testPathIgnorePatterns: ['/node_modules/', '\\.spec\\.js$'],
};
