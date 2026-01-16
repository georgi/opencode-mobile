import "@testing-library/jest-native/extend-expect"
import "react-native-gesture-handler/jestSetup"

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"))
jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper")
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}))
