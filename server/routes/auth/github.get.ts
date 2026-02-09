export default defineOAuthGitHubEventHandler({
  config: {
    scope: ['repo', 'notifications', 'read:discussion', 'read:org'],
  },
  async onSuccess(event, { user, tokens }) {
    await setUserSession(event, {
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        email: user.email,
      },
      secure: {
        accessToken: tokens.access_token,
      },
    })

    // Set default locale based on user settings
    const settings = await useStorage('data').getItem<{ locale?: string }>(`users:${user.id}:settings`)
    const locale = settings?.locale || 'en'
    return sendRedirect(event, `/${locale}/`)
  },
  onError(event, error) {
    console.error('[OAuth] GitHub OAuth error:', error)
    return sendRedirect(event, '/')
  },
})
