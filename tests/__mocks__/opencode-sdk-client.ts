export const createOpencodeClient = () => ({
  project: {
    list: async () => ({ data: [], error: undefined }),
  },
  session: {
    list: async () => ({ data: [], error: undefined }),
    create: async () => ({ data: undefined, error: undefined }),
    prompt: async () => ({ data: undefined, error: undefined }),
    abort: async () => ({ data: undefined, error: undefined }),
    revert: async () => ({ data: undefined, error: undefined }),
    unrevert: async () => ({ data: undefined, error: undefined }),
    diff: async () => ({ data: undefined, error: undefined }),
    summarize: async () => ({ data: undefined, error: undefined }),
    share: async () => ({ data: undefined, error: undefined }),
    unshare: async () => ({ data: undefined, error: undefined }),
  },
  permission: {
    list: async () => ({ data: undefined, error: undefined }),
    reply: async () => ({ data: undefined, error: undefined }),
  },
  event: {
    subscribe: async () => ({ stream: (async function* () {})() }),
  },
})
