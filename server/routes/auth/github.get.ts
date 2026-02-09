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
    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('[OAuth] GitHub OAuth error:', error)
    return sendRedirect(event, '/')
  },
})
