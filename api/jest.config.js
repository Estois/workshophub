/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: {
        module: 'commonjs',
      },
    },
  },
}

module.exports = config
