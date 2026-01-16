const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")
const { resolve } = require("metro-resolver")

const config = getDefaultConfig(__dirname)

// Enable Node-style `package.json#exports` resolution so imports like
// `@opencode-ai/sdk/v2/client` work in Metro.
config.resolver.unstable_enablePackageExports = true

// Force tslib to resolve to its CJS build so Hermes can load __extends.
const tslibPath = path.resolve(__dirname, "node_modules/tslib/tslib.js")
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  tslib: tslibPath,
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "tslib") {
    return resolve(context, tslibPath, platform)
  }

  return resolve(context, moduleName, platform)
}

module.exports = config
