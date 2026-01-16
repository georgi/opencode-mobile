import React from "react"
import { render } from "@testing-library/react-native"
import App from "../../App"

describe("App", () => {
  it("renders without crashing", () => {
    const { toJSON } = render(<App />)

    expect(toJSON()).toBeTruthy()
  })
})
