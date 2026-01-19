import "@testing-library/jest-native/extend-expect"
import "react-native-gesture-handler/jestSetup"

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"))
jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({}))
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}))

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
)

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

jest.mock("react-native/Libraries/NativeComponent/ViewConfigIgnore", () => {
  return {
    ConditionallyIgnoredEventHandlers: (value: unknown) => value,
    DynamicallyInjectedByGestureHandler: () => {},
  }
})
