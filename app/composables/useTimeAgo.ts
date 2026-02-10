function formatTimeAgo(timestamp: string, t: (key: string, params?: unknown) => string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)

  if (seconds < 60) return t('time.justNow')

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('time.minutesAgo', { count: minutes })

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hoursAgo', { count: hours })

  const days = Math.floor(hours / 24)
  if (days < 30) return t('time.daysAgo', { count: days })

  const months = Math.floor(days / 30)
  if (months < 12) return t('time.monthsAgo', { count: months })

  const years = Math.floor(months / 12)
  return t('time.yearsAgo', { count: years })
}

/** Reactive composable — for values that change over time (e.g. repo.pushedAt) */
export function useTimeAgo(date: Ref<string> | string) {
  const { t } = useI18n()
  return computed(() => {
    const timestamp = typeof date === 'string' ? date : date.value
    return formatTimeAgo(timestamp, t)
  })
}

/** Simple function — for static values in lists */
export function timeAgo(date: string): string {
  const { t } = useI18n()
  return formatTimeAgo(date, t)
}
