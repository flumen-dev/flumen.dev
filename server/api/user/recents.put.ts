const VALID_TYPES: CmdkRecentItemType[] = ['repo', 'issue', 'pr', 'user']
const ID_MAX = 200
const TITLE_MAX = 200
const SUBTITLE_MAX = 200

function isInternalPath(value: string): boolean {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
}

function isHttpsUrl(value: string): boolean {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  }
  catch {
    return false
  }
}

export default defineEventHandler(async (event): Promise<CmdkRecentItem[]> => {
  const session = await requireUserSession(event)
  const body = await readBody<Partial<CmdkRecentItem>>(event)

  if (!body?.type || !VALID_TYPES.includes(body.type)) {
    throw createError({ statusCode: 400, message: 'Invalid type' })
  }
  if (!body.id || typeof body.id !== 'string' || body.id.length > ID_MAX) {
    throw createError({ statusCode: 400, message: 'Invalid id' })
  }
  if (!body.title || typeof body.title !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing title' })
  }
  if (!body.url || !isInternalPath(body.url)) {
    throw createError({ statusCode: 400, message: 'Invalid url (must be internal path)' })
  }
  if (body.avatarUrl !== undefined && !isHttpsUrl(body.avatarUrl)) {
    throw createError({ statusCode: 400, message: 'Invalid avatarUrl' })
  }

  const item: CmdkRecentItem = {
    type: body.type,
    id: body.id,
    title: body.title.slice(0, TITLE_MAX),
    subtitle: typeof body.subtitle === 'string' ? body.subtitle.slice(0, SUBTITLE_MAX) : undefined,
    url: body.url,
    avatarUrl: body.avatarUrl,
    viewedAt: Date.now(),
  }

  const storage = useStorage('data')
  const key = `users:${session.user.id}:recents`
  const current = (await storage.getItem<CmdkRecentItem[]>(key)) ?? []

  const next = [item, ...current.filter(r => !(r.type === item.type && r.id === item.id))].slice(0, CMDK_RECENTS_CAP)
  await storage.setItem(key, next)

  return next
})
