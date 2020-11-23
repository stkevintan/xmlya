require('dotenv-flow').config();

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30 * 60 * 1000
};