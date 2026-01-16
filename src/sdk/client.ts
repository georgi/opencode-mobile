import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"

export type ClientConfig = {
  baseUrl: string
  directory: string
  basicAuth?: string
}

export function createSdkClient(config: ClientConfig) {
  const headers = config.basicAuth
    ? { Authorization: `Basic ${config.basicAuth}` }
    : undefined

  return createOpencodeClient({
    baseUrl: config.baseUrl,
    directory: config.directory,
    headers,
  })
}
