declare module '#auth-utils' {
  interface User {
    id: number
    login: string
    name: string | null
    avatarUrl: string
    email: string | null
  }

  interface SecureSessionData {
    accessToken: string
  }
}

export {}
