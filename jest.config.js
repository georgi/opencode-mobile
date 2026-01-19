module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/tests/**/*.test.ts?(x)"],
  moduleNameMapper: {
    "^@opencode-ai/sdk/v2/client$": "<rootDir>/tests/__mocks__/opencode-sdk-client.ts",
    "^react-native/Libraries/Animated/NativeAnimatedHelper$": "<rootDir>/tests/__mocks__/nativeAnimatedHelper.ts",
    "^@shopify/flash-list$": "<rootDir>/tests/__mocks__/flash-list.tsx",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@react-native|react-native|@react-navigation|@shopify|expo-.*|unorm|uuid|expo)/)",
  ],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
}
