import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node', // Change to 'jsdom' if testing React components
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],

  // 1. Enable Coverage Collection
  collectCoverage: true,

  // 2. Define which files to scan for coverage
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    // Exclude the "Noise" files
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/lib/api/dummy-data.ts',
    '!**/lib/api/mock-data.ts',
    '!**/lib/fonts.ts',
    '!**/*.d.ts',
  ],

  // 3. Output format SonarQube understands (lcov)
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],

  // 4. Path mapping (Mirroring your tsconfig if needed)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

export default config;