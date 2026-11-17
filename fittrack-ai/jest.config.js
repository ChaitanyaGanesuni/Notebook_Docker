/** Two projects: fast unit tests (pure logic, no device), and database tests that need Postgres. */
const base = {
  preset: 'jest-expo',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
module.exports = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/src/**/*.test.ts'] },
    {
      ...base,
      displayName: 'db',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/supabase/tests/**/*.test.ts'],
    },
  ],
};
