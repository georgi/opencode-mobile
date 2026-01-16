const { getDefaultConfig } = require("expo/metro-config")

const config = getDefaultConfig(__dirname)

// Enable Node-style `package.json#exports` resolution so imports like
// `@opencode-ai/sdk/v2/client` work in Metro.
config.resolver.unstable_enablePackageExports = true

module.exports = config
