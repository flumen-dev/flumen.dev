export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    const { $i18n } = useNuxtApp()
    return abortNavigation(createError({
      statusCode: 403,
      message: $i18n.t('auth.forbidden'),
    }))
  }
})
