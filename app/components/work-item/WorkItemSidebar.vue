<script lang="ts" setup>
import type { WorkItemDetail } from '~~/shared/types/work-item'

const props = defineProps<{
  workItem: WorkItemDetail
  repo: string
}>()

const { t, locale } = useI18n()
const { user } = useUserSession()
const { open: openProfile } = useUserProfileDialog()

const repoOwner = computed(() => props.repo.split('/')[0] ?? '')

// --- Helpers ---

interface TextSource {
  entryId: string
  author: string
  authorAvatar?: string
  text: string
}

function collectTextSources(wi: WorkItemDetail): TextSource[] {
  const sources: TextSource[] = []

  // Opening post body
  const initialEntry = wi.timeline.find(e => e.isInitial && e.source === wi.primaryType)
  if (wi.body) {
    sources.push({
      entryId: initialEntry?.subjectId ?? initialEntry?.id ?? '',
      author: wi.author.login,
      authorAvatar: wi.author.avatarUrl,
      text: wi.body,
    })
  }

  // All timeline entries with body (comments + reviews)
  for (const item of wi.timeline) {
    if (item.isInitial) continue
    if ((item.kind === 'comment' || item.kind === 'review') && item.body) {
      sources.push({
        entryId: item.subjectId ?? item.id,
        author: item.author,
        authorAvatar: item.authorAvatarUrl,
        text: item.body,
      })
    }
    // Review inline comments
    if (item.reviewComments) {
      for (const rc of item.reviewComments) {
        if (rc.body) {
          sources.push({
            entryId: item.subjectId ?? item.id,
            author: rc.author,
            authorAvatar: rc.authorAvatarUrl,
            text: rc.body,
          })
        }
      }
    }
  }

  return sources
}

// --- Scroll to comment ---

function scrollToComment(entryId: string) {
  const el = document.getElementById(`comment-${entryId}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    el.animate([
      { outline: '2px solid var(--color-primary-500)', outlineOffset: '3px' },
      { outline: '2px solid transparent', outlineOffset: '3px' },
    ], { duration: 1500, easing: 'ease-out' })
  }, 300)
}

// --- Participants ---

const participants = computed(() => {
  const map = new Map<string, { login: string, avatarUrl: string }>()
  map.set(props.workItem.author.login, props.workItem.author)

  for (const item of props.workItem.timeline) {
    if ((item.kind === 'comment' || item.kind === 'review') && item.authorAvatarUrl && !map.has(item.author)) {
      map.set(item.author, { login: item.author, avatarUrl: item.authorAvatarUrl })
    }
  }

  const owner = repoOwner.value.toLowerCase()
  return Array.from(map.values()).sort((a, b) => {
    const aOwner = a.login.toLowerCase() === owner
    const bOwner = b.login.toLowerCase() === owner
    if (aOwner !== bOwner) return aOwner ? -1 : 1
    return a.login.localeCompare(b.login)
  })
})

const ownerCommented = computed(() => {
  const owner = repoOwner.value.toLowerCase()
  return props.workItem.timeline.some(
    item => (item.kind === 'comment' || item.kind === 'review') && item.author.toLowerCase() === owner,
  )
})

// --- Mentions ---

interface MentionRef {
  entryId: string
  author: string
  authorAvatar?: string
}

function findMentionsOf(login: string): MentionRef[] {
  const target = login.toLowerCase()
  const regex = /(?:^|[\s(])@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)/gm
  const refs: MentionRef[] = []

  const sources = collectTextSources(props.workItem)
  for (const src of sources) {
    regex.lastIndex = 0
    let match
    let found = false
    while ((match = regex.exec(src.text)) !== null) {
      if (match[1]?.toLowerCase() === target) {
        found = true
        break
      }
    }
    if (found) {
      refs.push({ entryId: src.entryId, author: src.author, authorAvatar: src.authorAvatar })
    }
  }

  return refs
}

const myMentions = computed<MentionRef[]>(() => {
  if (!user.value) return []
  return findMentionsOf(user.value.login)
})

const ownerMentions = computed<MentionRef[]>(() => {
  if (!user.value || user.value.login.toLowerCase() === repoOwner.value.toLowerCase()) return []
  return findMentionsOf(repoOwner.value)
})

// --- Links ---

const REPRODUCTION_HOSTS = [
  'stackblitz.com',
  'codesandbox.io',
  'codepen.io',
  'jsfiddle.net',
  'play.vuejs.org',
  'repl.it',
  'replit.com',
]

function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s)\]>"'`,]+/g) ?? []
}

interface Occurrence {
  entryId: string
  author: string
  authorAvatar?: string
}

interface LinkGroup {
  url: string
  label: string
  icon: string
  occurrences: Occurrence[]
}

interface WorkItemLink {
  owner: string
  repo: string
  number: number
  label: string
  to: string
  occurrences: Occurrence[]
}

const GITHUB_ISSUE_PR_RE = /^\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/

function reproductionLabel(host: string): string {
  if (host.includes('stackblitz')) return 'StackBlitz'
  if (host.includes('codesandbox')) return 'CodeSandbox'
  if (host.includes('codepen')) return 'CodePen'
  if (host.includes('jsfiddle')) return 'JSFiddle'
  if (host.includes('vuejs.org')) return 'Vue Playground'
  if (host.includes('repl')) return 'Replit'
  return host
}

function githubPathLabel(pathname: string): string {
  const parts = pathname.slice(1).split('/')
  if (parts.length >= 4 && (parts[2] === 'issues' || parts[2] === 'pull')) {
    return `${parts[0]}/${parts[1]}#${parts[3]!}`
  }
  if (parts.length >= 4 && parts[2] === 'commit') {
    return `${parts[0]}/${parts[1]}@${parts[3]!.slice(0, 7)}`
  }
  if (parts.length >= 2) {
    return `${parts[0]!}/${parts[1]!}`
  }
  return pathname.slice(1) || 'github.com'
}

const links = computed(() => {
  const sources = collectTextSources(props.workItem)

  // Collect all URL occurrences
  const urlOccurrences = new Map<string, Occurrence[]>()
  for (const src of sources) {
    for (const url of extractUrls(src.text)) {
      const existing = urlOccurrences.get(url) ?? []
      existing.push({ entryId: src.entryId, author: src.author, authorAvatar: src.authorAvatar })
      urlOccurrences.set(url, existing)
    }
  }

  // Remove self-URL
  urlOccurrences.delete(props.workItem.url)

  const workItems: WorkItemLink[] = []
  const reproductions: LinkGroup[] = []
  const githubOther: LinkGroup[] = []
  const external: LinkGroup[] = []

  for (const [url, occurrences] of urlOccurrences) {
    try {
      const host = new URL(url).hostname.replace('www.', '')
      const { pathname } = new URL(url)

      if (REPRODUCTION_HOSTS.some(d => host.includes(d))) {
        reproductions.push({ url, label: reproductionLabel(host), icon: 'i-lucide-play-circle', occurrences })
      }
      else if (host === 'github.com') {
        const match = pathname.match(GITHUB_ISSUE_PR_RE)
        if (match) {
          const [, owner, repo, num] = match
          const number = Number(num)
          const isSameRepo = `${owner}/${repo}` === props.repo
          const label = isSameRepo ? `#${number}` : `${owner}/${repo}#${number}`
          const prefix = locale.value ? `/${locale.value}` : ''
          workItems.push({
            owner: owner!,
            repo: repo!,
            number,
            label,
            to: `${prefix}/repos/${owner}/${repo}/work-items/${number}`,
            occurrences,
          })
        }
        else {
          githubOther.push({ url, label: githubPathLabel(pathname), icon: 'i-lucide-link', occurrences })
        }
      }
      else {
        external.push({ url, label: host, icon: 'i-lucide-external-link', occurrences })
      }
    }
    catch {
      external.push({ url, label: url.slice(0, 40), icon: 'i-lucide-external-link', occurrences })
    }
  }

  // Filter out self-references
  const selfNumber = props.workItem.number
  const selfRepo = props.repo
  const filteredWorkItems = workItems.filter(
    wi => !(wi.number === selfNumber && `${wi.owner}/${wi.repo}` === selfRepo),
  )

  return { workItems: filteredWorkItems, reproductions, githubOther, external }
})

const allOtherLinks = computed(() => [
  ...links.value.githubOther,
  ...links.value.external,
])

// --- Expand/collapse ---

const participantsExpanded = ref(false)
const linksExpanded = ref(false)
const expandedLinks = ref(new Set<string>())

function toggleLinkExpand(url: string) {
  const next = new Set(expandedLinks.value)
  if (next.has(url)) next.delete(url)
  else next.add(url)
  expandedLinks.value = next
}

const visibleParticipants = computed(() =>
  participantsExpanded.value ? participants.value : participants.value.slice(0, 10),
)
const participantsOverflow = computed(() =>
  Math.max(0, participants.value.length - 10),
)

const visibleLinks = computed(() =>
  linksExpanded.value ? allOtherLinks.value : allOtherLinks.value.slice(0, 10),
)
const linksOverflow = computed(() =>
  Math.max(0, allOtherLinks.value.length - 10),
)
</script>

<template>
  <aside class="space-y-5 text-sm">
    <!-- Participants -->
    <div>
      <h3 class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        {{ t('issues.sidebar.participants') }}
      </h3>
      <div class="flex flex-wrap items-center gap-1">
        <UTooltip
          v-for="p in visibleParticipants"
          :key="p.login"
          :text="p.login"
        >
          <button
            type="button"
            class="cursor-pointer"
            @click="openProfile(p.login)"
          >
            <UAvatar
              :src="p.avatarUrl"
              :alt="p.login"
              size="2xs"
              class="ring-1 ring-default"
              :class="p.login.toLowerCase() === repoOwner.toLowerCase() ? 'ring-primary/50' : ''"
            />
          </button>
        </UTooltip>
        <button
          v-if="participantsOverflow > 0"
          class="text-xs text-muted hover:text-highlighted transition-colors ml-1"
          @click="participantsExpanded = !participantsExpanded"
        >
          {{ participantsExpanded ? t('issues.sidebar.showLess') : `+${participantsOverflow}` }}
        </button>
      </div>
      <div
        v-if="ownerCommented"
        class="mt-2 flex items-center gap-1.5 text-xs text-primary"
      >
        <UIcon
          name="i-lucide-shield-check"
          class="size-3.5"
        />
        {{ t('issues.sidebar.ownerActive') }}
      </div>
    </div>

    <!-- Mentions -->
    <div v-if="myMentions.length > 0 || ownerMentions.length > 0">
      <h3 class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        {{ t('issues.sidebar.mentions') }}
      </h3>
      <div class="space-y-3">
        <!-- My mentions -->
        <div v-if="myMentions.length > 0">
          <div class="flex items-center gap-1.5 mb-1">
            <UIcon
              name="i-lucide-at-sign"
              class="size-3.5 text-primary shrink-0"
            />
            <span class="text-xs font-medium text-highlighted">@{{ user!.login }}</span>
          </div>
          <div class="space-y-0.5 pl-5">
            <button
              v-for="ref in myMentions"
              :key="ref.entryId"
              class="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-0.5 -ml-1.5 hover:bg-elevated transition-colors group"
              @click="scrollToComment(ref.entryId)"
            >
              <UAvatar
                v-if="ref.authorAvatar"
                :src="ref.authorAvatar"
                :alt="ref.author"
                size="3xs"
              />
              <span class="text-xs text-muted group-hover:text-highlighted transition-colors">{{ ref.author }}</span>
              <UIcon
                name="i-lucide-corner-down-right"
                class="size-3 text-muted/40 group-hover:text-primary transition-colors ml-auto"
              />
            </button>
          </div>
        </div>

        <!-- Owner mentions -->
        <div v-if="ownerMentions.length > 0">
          <div class="flex items-center gap-1.5 mb-1">
            <UIcon
              name="i-lucide-at-sign"
              class="size-3.5 text-muted shrink-0"
            />
            <span class="text-xs text-muted">@{{ repoOwner }}</span>
          </div>
          <div class="space-y-0.5 pl-5">
            <button
              v-for="ref in ownerMentions"
              :key="ref.entryId"
              class="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-0.5 -ml-1.5 hover:bg-elevated transition-colors group"
              @click="scrollToComment(ref.entryId)"
            >
              <UAvatar
                v-if="ref.authorAvatar"
                :src="ref.authorAvatar"
                :alt="ref.author"
                size="3xs"
              />
              <span class="text-xs text-muted group-hover:text-highlighted transition-colors">{{ ref.author }}</span>
              <UIcon
                name="i-lucide-corner-down-right"
                class="size-3 text-muted/40 group-hover:text-primary transition-colors ml-auto"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Work Items -->
    <div v-if="links.workItems.length">
      <h3 class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        {{ t('issues.sidebar.workItems') }}
      </h3>
      <div class="space-y-1">
        <div
          v-for="wi in links.workItems"
          :key="`${wi.owner}/${wi.repo}#${wi.number}`"
        >
          <div class="flex items-center gap-1.5 group">
            <UIcon
              name="i-lucide-git-pull-request"
              class="size-3.5 text-primary shrink-0"
            />
            <NuxtLink
              :to="wi.to"
              class="text-xs text-primary hover:underline truncate flex-1 min-w-0"
            >
              {{ wi.label }}
            </NuxtLink>
            <!-- Single occurrence: direct scroll button -->
            <button
              v-if="wi.occurrences.length === 1"
              class="p-0.5 rounded text-muted/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
              @click="scrollToComment(wi.occurrences[0]!.entryId)"
            >
              <UIcon
                name="i-lucide-corner-down-right"
                class="size-3"
              />
            </button>
            <!-- Multiple occurrences: expand button with count -->
            <button
              v-else
              class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs text-muted/60 hover:text-primary transition-colors"
              @click="toggleLinkExpand(`wi-${wi.number}`)"
            >
              <span>{{ wi.occurrences.length }}</span>
              <UIcon
                :name="expandedLinks.has(`wi-${wi.number}`) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-3"
              />
            </button>
          </div>
          <!-- Expanded occurrences -->
          <div
            v-if="expandedLinks.has(`wi-${wi.number}`)"
            class="space-y-0.5 pl-5 mt-0.5"
          >
            <button
              v-for="(occ, oi) in wi.occurrences"
              :key="oi"
              class="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-0.5 -ml-1.5 hover:bg-elevated transition-colors group"
              @click="scrollToComment(occ.entryId)"
            >
              <UAvatar
                v-if="occ.authorAvatar"
                :src="occ.authorAvatar"
                :alt="occ.author"
                size="3xs"
              />
              <span class="text-xs text-muted group-hover:text-highlighted transition-colors">{{ occ.author }}</span>
              <UIcon
                name="i-lucide-corner-down-right"
                class="size-3 text-muted/40 group-hover:text-primary transition-colors ml-auto"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reproductions -->
    <div v-if="links.reproductions.length">
      <h3 class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        {{ t('issues.sidebar.reproductions') }}
      </h3>
      <div class="space-y-1">
        <div
          v-for="link in links.reproductions"
          :key="link.url"
        >
          <div class="flex items-center gap-1.5 group">
            <UIcon
              :name="link.icon"
              class="size-3.5 text-primary shrink-0"
            />
            <a
              :href="link.url"
              target="_blank"
              class="text-xs text-primary hover:underline truncate flex-1 min-w-0"
            >
              {{ link.label }}
            </a>
            <!-- Single occurrence: direct scroll button -->
            <button
              v-if="link.occurrences.length === 1"
              class="p-0.5 rounded text-muted/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
              @click="scrollToComment(link.occurrences[0]!.entryId)"
            >
              <UIcon
                name="i-lucide-corner-down-right"
                class="size-3"
              />
            </button>
            <!-- Multiple occurrences: expand button with count -->
            <button
              v-else
              class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs text-muted/60 hover:text-primary transition-colors"
              @click="toggleLinkExpand(link.url)"
            >
              <span>{{ link.occurrences.length }}</span>
              <UIcon
                :name="expandedLinks.has(link.url) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-3"
              />
            </button>
          </div>
          <!-- Expanded occurrences -->
          <div
            v-if="expandedLinks.has(link.url)"
            class="space-y-0.5 pl-5 mt-0.5"
          >
            <button
              v-for="(occ, oi) in link.occurrences"
              :key="oi"
              class="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-0.5 -ml-1.5 hover:bg-elevated transition-colors group"
              @click="scrollToComment(occ.entryId)"
            >
              <UAvatar
                v-if="occ.authorAvatar"
                :src="occ.authorAvatar"
                :alt="occ.author"
                size="3xs"
              />
              <span class="text-xs text-muted group-hover:text-highlighted transition-colors">{{ occ.author }}</span>
              <UIcon
                name="i-lucide-corner-down-right"
                class="size-3 text-muted/40 group-hover:text-primary transition-colors ml-auto"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Links -->
    <div v-if="allOtherLinks.length">
      <h3 class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        {{ t('issues.sidebar.links') }}
      </h3>
      <div class="space-y-1">
        <div
          v-for="link in visibleLinks"
          :key="link.url"
        >
          <div class="flex items-center gap-1.5 group">
            <UIcon
              :name="link.icon"
              class="size-3.5 text-muted shrink-0"
            />
            <a
              :href="link.url"
              target="_blank"
              class="text-xs text-muted hover:text-highlighted transition-colors truncate flex-1 min-w-0"
            >
              {{ link.label }}
            </a>
            <!-- Single occurrence: direct scroll button -->
            <button
              v-if="link.occurrences.length === 1"
              class="p-0.5 rounded text-muted/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
              @click="scrollToComment(link.occurrences[0]!.entryId)"
            >
              <UIcon
                name="i-lucide-corner-down-right"
                class="size-3"
              />
            </button>
            <!-- Multiple occurrences: expand button with count -->
            <button
              v-else
              class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs text-muted/60 hover:text-primary transition-colors"
              @click="toggleLinkExpand(link.url)"
            >
              <span>{{ link.occurrences.length }}</span>
              <UIcon
                :name="expandedLinks.has(link.url) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-3"
              />
            </button>
          </div>
          <!-- Expanded occurrences -->
          <div
            v-if="expandedLinks.has(link.url)"
            class="space-y-0.5 pl-5 mt-0.5"
          >
            <button
              v-for="(occ, oi) in link.occurrences"
              :key="oi"
              class="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-0.5 -ml-1.5 hover:bg-elevated transition-colors group"
              @click="scrollToComment(occ.entryId)"
            >
              <UAvatar
                v-if="occ.authorAvatar"
                :src="occ.authorAvatar"
                :alt="occ.author"
                size="3xs"
              />
              <span class="text-xs text-muted group-hover:text-highlighted transition-colors">{{ occ.author }}</span>
              <UIcon
                name="i-lucide-corner-down-right"
                class="size-3 text-muted/40 group-hover:text-primary transition-colors ml-auto"
              />
            </button>
          </div>
        </div>
        <button
          v-if="linksOverflow > 0"
          class="text-xs text-muted hover:text-highlighted transition-colors"
          @click="linksExpanded = !linksExpanded"
        >
          {{ linksExpanded ? t('issues.sidebar.showLess') : `+${linksOverflow}` }}
        </button>
      </div>
    </div>
  </aside>
</template>
