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
  messageKey: string
  busy: boolean
  expiresIn: string | null
}

export const STATUS_PRESETS: StatusPreset[] = [
  { key: 'fluming', emoji: ':ocean:', emojiUnicode: '🌊', messageKey: 'status.presets.fluming', busy: false, expiresIn: null },
  { key: 'coding', emoji: ':hammer:', emojiUnicode: '🔨', messageKey: 'status.presets.coding', busy: false, expiresIn: null },
  { key: 'reviewing', emoji: ':eyes:', emojiUnicode: '👀', messageKey: 'status.presets.reviewing', busy: false, expiresIn: null },
  { key: 'focused', emoji: ':dart:', emojiUnicode: '🎯', messageKey: 'status.presets.focused', busy: true, expiresIn: '4h' },
  { key: 'wfh', emoji: ':house:', emojiUnicode: '🏠', messageKey: 'status.presets.wfh', busy: false, expiresIn: 'today' },
  { key: 'mobile', emoji: ':iphone:', emojiUnicode: '📱', messageKey: 'status.presets.mobile', busy: false, expiresIn: null },
  { key: 'break', emoji: ':coffee:', emojiUnicode: '☕', messageKey: 'status.presets.break', busy: false, expiresIn: '30m' },
  { key: 'away', emoji: ':palm_tree:', emojiUnicode: '🌴', messageKey: 'status.presets.away', busy: false, expiresIn: 'week' },
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

export type ExpiryOption = '30m' | '1h' | '4h' | 'today' | 'week' | 'never'

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
    case 'week': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    case 'never': return null
  }
}
