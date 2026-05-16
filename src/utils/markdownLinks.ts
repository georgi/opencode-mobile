import { Linking } from "react-native"

// URLs come from assistant-controlled markdown. Limit Linking.openURL to
// browser schemes so a crafted link can't launch tel:/sms:/intent:/app
// deep links from a tap inside a message.
const ALLOWED_LINK_SCHEMES = new Set(["http:", "https:"])

/**
 * onLinkPress handler for react-native-markdown-display.
 * Returns true so the library treats the link as handled either way; the
 * tap is silently ignored for disallowed or malformed URLs.
 */
export function handleMarkdownLink(url: string): boolean {
  let scheme: string
  try {
    scheme = new URL(url).protocol
  } catch {
    return true
  }
  if (!ALLOWED_LINK_SCHEMES.has(scheme)) {
    return true
  }
  void Linking.openURL(url).catch(() => {
    /* no installed handler — swallow silently */
  })
  return true
}
