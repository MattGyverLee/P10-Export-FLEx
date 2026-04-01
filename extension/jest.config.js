/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    // Mock PAPI modules - these MUST come before other mappings
    '^@papi/backend$': '<rootDir>/src/__tests__/__mocks__/@papi/backend.ts',
    '^@papi/core$': '<rootDir>/src/__tests__/__mocks__/@papi/core.ts',
    '^@papi/frontend$': '<rootDir>/src/__tests__/__mocks__/@papi/frontend.ts',
    '^@papi/frontend/react$': '<rootDir>/src/__tests__/__mocks__/@papi/frontend-react.ts',

    // Mock Platform Bible modules
    '^platform-bible-react$': '<rootDir>/src/__tests__/__mocks__/platform-bible-react.tsx',
    '^platform-bible-utils$': '<rootDir>/src/__tests__/__mocks__/platform-bible-utils.ts',

    // Mock Scripture module
    '^@sillsdev/scripture$': '<rootDir>/src/__tests__/__mocks__/@sillsdev-scripture.ts',

    // Handle CSS imports
    '\\.(css|scss|sass)$': 'identity-obj-proxy',

    // Handle WebView inline imports
    '\\?inline$': '<rootDir>/src/__tests__/__mocks__/inline-loader.ts',
  },
  // Transform modules in node_modules that need to be compiled
  transformIgnorePatterns: [
    'node_modules/(?!(platform-bible-utils|platform-bible-react)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/**/temp-build/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  // Ignore webpack config files during tests
  testPathIgnorePatterns: ['/node_modules/', '/webpack/'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
