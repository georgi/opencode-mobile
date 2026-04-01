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

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium", Heavy: "Heavy" },
  NotificationFeedbackType: { Success: "Success", Warning: "Warning", Error: "Error" },
}))

// Mock XMLHttpRequest for DebugSse
class MockXMLHttpRequest {
  static readonly UNSENT = 0
  static readonly OPENED = 1
  static readonly HEADERS_RECEIVED = 2
  static readonly LOADING = 3
  static readonly DONE = 4

  readyState = 0
  status = 0
  responseText = ""
  withCredentials = false
  timeout = 0
  onreadystatechange: (() => void) | null = null
  onerror: (() => void) | null = null

  open() {}
  setRequestHeader() {}
  send() {
    // Simulate HEADERS_RECEIVED
    this.readyState = MockXMLHttpRequest.HEADERS_RECEIVED
    this.status = 200
    if (this.onreadystatechange) this.onreadystatechange()
  }
  abort() {}
  getAllResponseHeaders() {
    return ""
  }
}

if (typeof globalThis.XMLHttpRequest === "undefined") {
  ;(globalThis as any).XMLHttpRequest = MockXMLHttpRequest
}
