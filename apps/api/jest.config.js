/**
 * NestJS 12 ships ESM-only packages. Node >= 24.9 can require() them natively, so Jest leaves
 * node_modules alone and only transpile-compiles our TypeScript via ts-jest (no type check;
 * `yarn typecheck` covers types). Requires engines.node >= 24.22.1.
 */
/** @type {import('jest').Config} */
const shared = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.jest.json', diagnostics: false },
    ],
  },
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      ...shared,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      globalSetup: '<rootDir>/test/setup/global-setup.js',
      setupFiles: ['<rootDir>/test/setup/env.js'],
      testTimeout: 30000,
    },
  ],
};
