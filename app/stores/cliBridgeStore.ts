const CLI_BASE = 'http://localhost:31420'

export const useCliBridgeStore = defineStore('cliBridge', () => {
  const { settings, update: updateSettings } = useUserSettings()

  // State
  const connected = ref(false)
  const pushState = ref<'first_push' | 'has_commits' | 'nothing' | null>(null)
  const hasPr = ref(false)
  const lastPrUrl = ref<string | null>(null)
  const polling = ref(false)

  // Token lives in user settings (KV store)
  const token = computed(() => settings.value?.cliToken ?? null)

  // Auto-check connection on client when token exists
  // Once disconnected (CLI unreachable), stay disconnected until manual reconnect
  let healthInterval: ReturnType<typeof setInterval> | null = null

  function startHealthCheck() {
    stopHealthCheck()
    healthInterval = setInterval(async () => {
      const res = await cliFetch<{ connected: boolean }>('/state')
      if (!res || !res.connected) {
        connected.value = false
        stopHealthCheck()
        await updateSettings({ cliToken: null })
      }
    }, 10_000)
  }

  function stopHealthCheck() {
    if (healthInterval) {
      clearInterval(healthInterval)
      healthInterval = null
    }
  }

  if (import.meta.client) {
    watch(token, (t) => {
      if (t) checkConnection()
      else {
        connected.value = false
        stopHealthCheck()
      }
    }, { immediate: true })

    watch(connected, (isConnected) => {
      if (isConnected) startHealthCheck()
      else stopHealthCheck()
    })
  }

  // Internal fetch helper — all CLI calls go through here
  async function cliFetch<T>(path: string, options: RequestInit = {}): Promise<T | null> {
    if (!token.value) return null
    try {
      const res = await fetch(`${CLI_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      if (!res.ok) return null
      return await res.json() as T
    }
    catch {
      return null
    }
  }

  async function connect(inputToken: string) {
    try {
      const res = await fetch(`${CLI_BASE}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inputToken }),
      })
      if (!res.ok) return false
      const data = await res.json() as { success: boolean }
      if (data.success) {
        connected.value = true
        await updateSettings({ cliToken: inputToken })
        return true
      }
    }
    catch { /* CLI not reachable */ }
    return false
  }

  async function disconnect() {
    await cliFetch('/disconnect', { method: 'POST' })
    connected.value = false
    pushState.value = null
    hasPr.value = false
    lastPrUrl.value = null
    await updateSettings({ cliToken: null })
  }

  async function checkConnection() {
    if (!token.value) {
      connected.value = false
      return
    }
    const res = await cliFetch<{ connected: boolean }>('/state')
    connected.value = res?.connected ?? false
    if (!connected.value) {
      await updateSettings({ cliToken: null })
    }
  }

  async function fetchPushState() {
    if (!connected.value) return
    polling.value = true
    try {
      const res = await cliFetch<{ pushState: 'first_push' | 'has_commits' | 'nothing', hasPr: boolean, prUrl: string | null }>('/push')
      pushState.value = res?.pushState ?? null
      hasPr.value = res?.hasPr ?? false
      if (res?.prUrl) lastPrUrl.value = res.prUrl
    }
    finally {
      polling.value = false
    }
  }

  async function push(opts?: { title?: string, issueNumber?: number }) {
    if (!connected.value) return null
    const res = await cliFetch<
      | { status: 'pushed_with_pr', pr: string }
      | { status: 'created_pr', pr: string }
      | { status: 'pushed' }
      | { status: 'nothing' }
      | { status: 'error', message: string }
    >('/push', {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
    })
    if (!res) return null
    if (res.status === 'pushed_with_pr' || res.status === 'created_pr') {
      lastPrUrl.value = res.pr
      hasPr.value = true
    }
    return res
  }

  // CLI-side checkout after server-side claim
  async function checkout(branchName: string, repo: string) {
    if (!connected.value) return null
    return await cliFetch<
      | { status: 'ok', message: string }
      | { status: 'error', message: string }
    >('/checkout', {
      method: 'POST',
      body: JSON.stringify({ branch: branchName, repo }),
    })
  }

  return {
    connected,
    token,
    pushState,
    hasPr,
    lastPrUrl,
    polling,

    connect,
    disconnect,
    checkConnection,
    fetchPushState,
    push,
    checkout,
  }
})
