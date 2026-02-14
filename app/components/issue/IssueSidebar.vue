<script lang="ts" setup>
import type { IssueDetail } from '~~/shared/types/issue-detail'

const props = defineProps<{
  issue: IssueDetail
  repo: string
}>()

const { t } = useI18n()
const { user } = useUserSession()

const repoOwner = computed(() => props.repo.split('/')[0] ?? '')

// --- Scroll to comment ---

function scrollToComment(commentId: string) {
  const el = document.getElementById(`comment-${commentId}`)
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
  map.set(props.issue.author.login, props.issue.author)

  for (const item of props.issue.timeline) {
    if (item.type === 'IssueComment' && !map.has(item.author.login)) {
      map.set(item.author.login, item.author)
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
  return props.issue.timeline.some(
    item => item.type === 'IssueComment' && item.author.login.toLowerCase() === owner,
  )
})

// --- Mentions ---

interface MentionRef {
  commentId: string
  author: string
  authorAvatar: string
}

function findMentionsOf(login: string): MentionRef[] {
  const target = login.toLowerCase()
  const regex = /(?:^|[\s(])@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)/gm
  const refs: MentionRef[] = []

  function hasMatch(text: string): boolean {
    regex.lastIndex = 0
    let match
    while ((match = regex.exec(text)) !== null) {
      if (match[1]?.toLowerCase() === target) return true
    }
    return false
  }

  if (hasMatch(props.issue.body)) {
    refs.push({
      commentId: props.issue.id,
      author: props.issue.author.login,
      authorAvatar: props.issue.author.avatarUrl,
    })
  }

  for (const item of props.issue.timeline) {
    if (item.type === 'IssueComment' && hasMatch(item.body)) {
      refs.push({
        commentId: item.id,
        author: item.author.login,
        authorAvatar: item.author.avatarUrl,
      })
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

interface LinkItem {
  url: string
  label: string
  icon: string
  commentId: string
}

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
  const urlToComment = new Map<string, string>()

  for (const url of extractUrls(props.issue.body)) {
    if (!urlToComment.has(url)) urlToComment.set(url, props.issue.id)
  }
  for (const item of props.issue.timeline) {
    if (item.type === 'IssueComment') {
      for (const url of extractUrls(item.body)) {
        if (!urlToComment.has(url)) urlToComment.set(url, item.id)
      }
    }
  }

  urlToComment.delete(props.issue.url)

  const reproductions: LinkItem[] = []
  const github: LinkItem[] = []
  const external: LinkItem[] = []

  for (const [url, commentId] of urlToComment) {
    try {
      const host = new URL(url).hostname.replace('www.', '')
      const { pathname } = new URL(url)

      if (REPRODUCTION_HOSTS.some(d => host.includes(d))) {
        reproductions.push({ url, label: reproductionLabel(host), icon: 'i-lucide-play-circle', commentId })
      }
      else if (host === 'github.com') {
        github.push({ url, label: githubPathLabel(pathname), icon: 'i-lucide-link', commentId })
      }
      else {
        external.push({ url, label: host, icon: 'i-lucide-external-link', commentId })
      }
    }
    catch {
      external.push({ url, label: url.slice(0, 40), icon: 'i-lucide-external-link', commentId })
    }
  }

  return { reproductions, github, external }
})

const allOtherLinks = computed(() => [
  ...links.value.github,
  ...links.value.external,
])

// --- Expand/collapse ---

const participantsExpanded = ref(false)
const linksExpanded = ref(false)

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
          <UAvatar
            :src="p.avatarUrl"
            :alt="p.login"
            size="2xs"
            class="ring-1 ring-default"
            :class="p.login.toLowerCase() === repoOwner.toLowerCase() ? 'ring-primary/50' : ''"
          />
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
              :key="ref.commentId"
              class="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-0.5 -ml-1.5 hover:bg-elevated transition-colors group"
              @click="scrollToComment(ref.commentId)"
            >
              <UAvatar
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
              :key="ref.commentId"
              class="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-0.5 -ml-1.5 hover:bg-elevated transition-colors group"
              @click="scrollToComment(ref.commentId)"
            >
              <UAvatar
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

    <!-- Reproductions -->
    <div v-if="links.reproductions.length">
      <h3 class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        {{ t('issues.sidebar.reproductions') }}
      </h3>
      <div class="space-y-1">
        <div
          v-for="link in links.reproductions"
          :key="link.url"
          class="flex items-center gap-1.5 group"
        >
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
          <button
            class="p-0.5 rounded text-muted/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
            @click="scrollToComment(link.commentId)"
          >
            <UIcon
              name="i-lucide-corner-down-right"
              class="size-3"
            />
          </button>
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
          class="flex items-center gap-1.5 group"
        >
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
          <button
            class="p-0.5 rounded text-muted/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
            @click="scrollToComment(link.commentId)"
          >
            <UIcon
              name="i-lucide-corner-down-right"
              class="size-3"
            />
          </button>
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
