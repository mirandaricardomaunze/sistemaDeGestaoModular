module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    globalSetup: '<rootDir>/jest.globalSetup.ts',
    setupFiles: ['<rootDir>/jest.setup.ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    maxWorkers: 1,
    workerIdleMemoryLimit: '512MB',
    testTimeout: 30000,
    forceExit: true,
};
