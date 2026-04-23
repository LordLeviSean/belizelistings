const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.js"],
};

module.exports = createJestConfig(customJestConfig);

