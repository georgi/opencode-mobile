module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/tests/**/*.test.ts?(x)"],
  moduleNameMapper: {
    "^@opencode-ai/sdk/v2/client$": "<rootDir>/tests/__mocks__/opencode-sdk-client.ts",
  },
}
