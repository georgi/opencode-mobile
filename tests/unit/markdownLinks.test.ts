import { Linking } from "react-native"
import { handleMarkdownLink } from "../../src/utils/markdownLinks"

describe("handleMarkdownLink", () => {
  let openURL: jest.SpyInstance

  beforeEach(() => {
    openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true)
  })

  afterEach(() => {
    openURL.mockRestore()
  })

  it("opens http URLs", () => {
    expect(handleMarkdownLink("http://example.com")).toBe(true)
    expect(openURL).toHaveBeenCalledWith("http://example.com")
  })

  it("opens https URLs", () => {
    expect(handleMarkdownLink("https://example.com/path?q=1")).toBe(true)
    expect(openURL).toHaveBeenCalledWith("https://example.com/path?q=1")
  })

  // Assistant-controlled markdown shouldn't be able to invoke arbitrary URL
  // schemes on tap. Each of these must be blocked but still report handled.
  it.each([
    "tel:+15555550100",
    "sms:+15555550100",
    "mailto:user@example.com",
    "intent://launch#Intent;scheme=http;end",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "myapp://do-something",
  ])("blocks non-browser scheme: %s", (url) => {
    expect(handleMarkdownLink(url)).toBe(true)
    expect(openURL).not.toHaveBeenCalled()
  })

  it("swallows malformed URLs without throwing", () => {
    expect(handleMarkdownLink("not a url")).toBe(true)
    expect(openURL).not.toHaveBeenCalled()
  })
})
