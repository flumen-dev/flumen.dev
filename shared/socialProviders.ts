export interface SocialProvider {
  id: string
  name: string
  icon: string
  hex: string
  baseUrl: string
  placeholder: string
}

export const socialProviders: SocialProvider[] = [
  { id: 'youtube', name: 'YouTube', icon: 'i-simple-icons-youtube', hex: '#FF0000', baseUrl: 'https://youtube.com/@', placeholder: 'username' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'i-simple-icons-linkedin', hex: '#0A66C2', baseUrl: 'https://linkedin.com/in/', placeholder: 'username' },
  { id: 'instagram', name: 'Instagram', icon: 'i-simple-icons-instagram', hex: '#E4405F', baseUrl: 'https://instagram.com/', placeholder: 'username' },
  { id: 'facebook', name: 'Facebook', icon: 'i-simple-icons-facebook', hex: '#0866FF', baseUrl: 'https://facebook.com/', placeholder: 'username' },
  { id: 'bluesky', name: 'Bluesky', icon: 'i-simple-icons-bluesky', hex: '#0085FF', baseUrl: 'https://bsky.app/profile/', placeholder: 'handle.bsky.social' },
  { id: 'x', name: 'X', icon: 'i-simple-icons-x', hex: '#000000', baseUrl: 'https://x.com/', placeholder: 'username' },
  { id: 'mastodon', name: 'Mastodon', icon: 'i-simple-icons-mastodon', hex: '#6364FF', baseUrl: 'https://mastodon.social/@', placeholder: 'username' },
  { id: 'reddit', name: 'Reddit', icon: 'i-simple-icons-reddit', hex: '#FF4500', baseUrl: 'https://reddit.com/user/', placeholder: 'username' },
  { id: 'devto', name: 'DEV', icon: 'i-simple-icons-devdotto', hex: '#0A0A0A', baseUrl: 'https://dev.to/', placeholder: 'username' },
  { id: 'github', name: 'GitHub', icon: 'i-simple-icons-github', hex: '#181717', baseUrl: 'https://github.com/', placeholder: 'username' },
  { id: 'twitch', name: 'Twitch', icon: 'i-simple-icons-twitch', hex: '#9146FF', baseUrl: 'https://twitch.tv/', placeholder: 'username' },
  { id: 'website', name: 'Website', icon: 'i-lucide-globe', hex: '', baseUrl: 'https://', placeholder: 'example.com' },
]

const urlPatterns: [string, string][] = [
  ['youtube.com', 'youtube'],
  ['linkedin.com', 'linkedin'],
  ['instagram.com', 'instagram'],
  ['facebook.com', 'facebook'],
  ['bsky.app', 'bluesky'],
  ['x.com', 'x'],
  ['twitter.com', 'x'],
  ['mastodon.social', 'mastodon'],
  ['reddit.com', 'reddit'],
  ['dev.to', 'devto'],
  ['github.com', 'github'],
  ['twitch.tv', 'twitch'],
]

export function detectProvider(url: string): SocialProvider {
  const match = urlPatterns.find(([domain]) => url.includes(domain))
  const fallback = socialProviders.find(p => p.id === 'website')!
  if (!match) return fallback
  return socialProviders.find(p => p.id === match[1]) ?? fallback
}
