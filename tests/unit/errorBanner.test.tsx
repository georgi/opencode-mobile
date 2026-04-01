import React from "react"
import { render, act, fireEvent } from "@testing-library/react-native"
import { ErrorBanner } from "../../src/components/ErrorBanner"
import { useSessionStore } from "../../src/store/sessionStore"

describe("ErrorBanner", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useSessionStore.getState().reset()
    useSessionStore.getState().clearError()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders error text when lastError is set", () => {
    useSessionStore.setState({ lastError: "Something went wrong" })

    const { getByText } = render(<ErrorBanner />)

    expect(getByText("Something went wrong")).toBeTruthy()
  })

  it("returns null when no error", () => {
    useSessionStore.setState({ lastError: undefined })

    const { toJSON } = render(<ErrorBanner />)

    expect(toJSON()).toBeNull()
  })

  it("auto-dismisses after 5 seconds", () => {
    useSessionStore.setState({ lastError: "Temporary error", errorSeq: 1 })

    const { toJSON, rerender } = render(<ErrorBanner />)

    // Error should be visible initially
    expect(toJSON()).not.toBeNull()

    // Advance time by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    // Re-render to pick up the state change from clearError
    rerender(<ErrorBanner />)

    // Error should be cleared
    expect(useSessionStore.getState().lastError).toBeUndefined()
  })

  it("resets timer when errorSeq changes (duplicate error)", () => {
    useSessionStore.setState({ lastError: "Error", errorSeq: 1 })

    render(<ErrorBanner />)

    // Advance 3 seconds (not enough to dismiss)
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // Same error message but errorSeq incremented — should reset the timer
    act(() => {
      useSessionStore.setState({ lastError: "Error", errorSeq: 2 })
    })

    // Advance another 3 seconds (6 total from start, but only 3 from re-trigger)
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // Error should still be visible (timer was reset)
    expect(useSessionStore.getState().lastError).toBe("Error")

    // Advance the remaining 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    // Now it should be cleared
    expect(useSessionStore.getState().lastError).toBeUndefined()
  })

  it("clears error on press", () => {
    useSessionStore.setState({ lastError: "Click to dismiss" })

    const { getByText } = render(<ErrorBanner />)

    fireEvent.press(getByText("Click to dismiss"))

    expect(useSessionStore.getState().lastError).toBeUndefined()
  })
})
