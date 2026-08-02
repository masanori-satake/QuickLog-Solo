module.exports = {
    testEnvironment: 'jsdom',
    setupFiles: ['<rootDir>/jest.setup.cjs'],
    moduleNameMapper: {
        '^\\.\\./shared/(.*)$': '<rootDir>/shared/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {},
    testPathIgnorePatterns: ['/node_modules/', '\\.spec\\.js$'],
};
