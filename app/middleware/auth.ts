export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    const localePath = useLocalePath()
    return navigateTo(localePath('/'))
  }
})
