/**
 * Jest Configuration
 *
 * Updated by: Berry (DevOps)
 * Requirement: REQ-STRATEGIC-AUTO-1766584106655
 * Purpose: Fix Jest configuration to enable TypeScript test execution
 * Addresses: Billy QA Issue #3 (CRITICAL PRIORITY)
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.integration.test.ts',
    '**/*.spec.ts', // REQ-1767183219586: Include WebSocket security tests
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
};
