export interface UserStatus {
  emoji: string | null
  message: string | null
  limitedAvailability: boolean
  expiresAt: string | null
}

export interface StatusPreset {
  key: string
  emoji: string
  emojiUnicode: string
  busy: boolean
  expiresIn: ExpiryOption | null
}

export type ExpiryOption = '30m' | '1h' | '4h' | 'today' | 'week' | 'never'

export const STATUS_PRESETS: StatusPreset[] = [
  { key: 'fluming', emoji: ':ocean:', emojiUnicode: '🌊', busy: false, expiresIn: null },
  { key: 'coding', emoji: ':hammer:', emojiUnicode: '🔨', busy: false, expiresIn: null },
  { key: 'reviewing', emoji: ':eyes:', emojiUnicode: '👀', busy: false, expiresIn: null },
  { key: 'focused', emoji: ':dart:', emojiUnicode: '🎯', busy: true, expiresIn: '4h' },
  { key: 'wfh', emoji: ':house:', emojiUnicode: '🏠', busy: false, expiresIn: 'today' },
  { key: 'mobile', emoji: ':iphone:', emojiUnicode: '📱', busy: false, expiresIn: null },
  { key: 'break', emoji: ':coffee:', emojiUnicode: '☕', busy: false, expiresIn: '30m' },
  { key: 'away', emoji: ':palm_tree:', emojiUnicode: '🌴', busy: false, expiresIn: 'week' },
]

/** Map of GitHub shortcodes used in presets to Unicode. */
const SHORTCODE_MAP: Record<string, string> = Object.fromEntries(
  STATUS_PRESETS.map(p => [p.emoji, p.emojiUnicode]),
)

/** Convert a GitHub emoji shortcode (e.g. `:hammer:`) to Unicode. Returns the input if unknown. */
export function shortcodeToUnicode(shortcode: string | null): string | null {
  if (!shortcode) return null
  return SHORTCODE_MAP[shortcode] ?? shortcode
}

/** Raw status fields as returned by the GitHub GraphQL API. */
export interface GitHubStatusFields {
  emoji: string | null
  message: string | null
  indicatesLimitedAvailability: boolean
  expiresAt: string | null
}

/** Map raw GraphQL status fields to our UserStatus shape. */
export function mapGitHubStatus(s: GitHubStatusFields | null): UserStatus {
  return {
    emoji: s?.emoji ?? null,
    message: s?.message ?? null,
    limitedAvailability: s?.indicatesLimitedAvailability ?? false,
    expiresAt: s?.expiresAt ?? null,
  }
}

export function expiryToDate(option: ExpiryOption): string | null {
  const now = new Date()
  switch (option) {
    case '30m': return new Date(now.getTime() + 30 * 60 * 1000).toISOString()
    case '1h': return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    case '4h': return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString()
    case 'today': {
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      return end.toISOString()
    }
    case 'week': {
      const end = new Date(now)
      const daysUntilSunday = (7 - end.getDay()) % 7 || 7
      end.setDate(end.getDate() + daysUntilSunday)
      end.setHours(23, 59, 59, 999)
      return end.toISOString()
    }
    case 'never': return null
  }
}
