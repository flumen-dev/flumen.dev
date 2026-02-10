export const languageColors: Record<string, string> = {
  'TypeScript': '#3178c6',
  'JavaScript': '#f1e05a',
  'Python': '#3572A5',
  'Rust': '#dea584',
  'Go': '#00ADD8',
  'Java': '#b07219',
  'C#': '#178600',
  'C++': '#f34b7d',
  'C': '#555555',
  'Ruby': '#701516',
  'PHP': '#4F5D95',
  'Swift': '#F05138',
  'Kotlin': '#A97BFF',
  'Dart': '#00B4AB',
  'Shell': '#89e051',
  'HTML': '#e34c26',
  'CSS': '#563d7c',
  'Vue': '#41b883',
  'Svelte': '#ff3e00',
  'Lua': '#000080',
  'Zig': '#ec915c',
  'Elixir': '#6e4a7e',
  'Scala': '#c22d40',
  'Haskell': '#5e5086',
}

export function getLanguageColor(language: string | null): string {
  if (!language) return '#8b8b8b'
  return languageColors[language] || '#8b8b8b'
}
