module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],
  verbose: true,
  forceExit: true, // Force exit after tests are done
  clearMocks: true,
  resetMocks: true,
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
};
