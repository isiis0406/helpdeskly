import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { buildControlApiUrl } from '@/lib/env'

export const { handlers, auth } = NextAuth({
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const res = await fetch(buildControlApiUrl('/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
            tenantSlug: (credentials as any).tenantSlug || undefined,
          }),
        })

        if (!res.ok) return null
        const data = await res.json()

        // Expecting backend to return accessToken, refreshToken, user
        if (!data?.accessToken) return null

        const expiresIn = data?.expiresIn || data?.tokens?.expiresIn || 900
        const accessToken = data?.accessToken || data?.tokens?.accessToken
        const refreshToken = data?.refreshToken || data?.tokens?.refreshToken
        const accessTokenExpires = Date.now() + expiresIn * 1000

        return {
          id: data.user?.id || data.userId || 'unknown',
          email: data.user?.email || credentials.email,
          name: data.user?.name || '',
          accessToken,
          refreshToken,
          accessTokenExpires,
        } as any
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.accessToken = (user as any).accessToken
        token.refreshToken = (user as any).refreshToken
        token.accessTokenExpires = (user as any).accessTokenExpires
        token.name = user.name
        token.email = user.email
        return token
      }

      // Refresh if expired (60s leeway)
      const willExpire =
        typeof token.accessTokenExpires === 'number' &&
        Date.now() > (token.accessTokenExpires as number) - 60_000

      if (willExpire && token.refreshToken) {
        try {
          const res = await fetch(buildControlApiUrl('/auth/refresh'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token.refreshToken }),
          })
          if (res.ok) {
            const data = await res.json()
            const expiresIn = data?.expiresIn || data?.tokens?.expiresIn || 900
            token.accessToken = data?.accessToken || data?.tokens?.accessToken
            token.refreshToken = data?.refreshToken || token.refreshToken
            token.accessTokenExpires = Date.now() + expiresIn * 1000
          }
        } catch {}
      }
      return token
    },
    session: async ({ session, token }) => {
      ;(session as any).accessToken = token.accessToken
      ;(session as any).accessTokenExpires = token.accessTokenExpires
      return session
    },
  },
})

export const { GET, POST } = handlers
