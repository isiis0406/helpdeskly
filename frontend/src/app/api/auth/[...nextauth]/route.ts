import { buildControlApiUrl } from "@/lib/env";
import NextAuth from "next-auth";
import { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";

// ✅ FONCTION DE REFRESH COMME TON ANCIEN CODE
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const refreshToken = (token as any)?.refreshToken;
    if (!refreshToken) {
      console.error("❌ Missing refresh token");
      return {
        ...token,
        error: "MissingRefreshToken",
      };
    }

    console.log("🔄 Refreshing access token...");

    const response = await fetch(buildControlApiUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // UA neutre pour éviter les mismatches serveur
        "user-agent": "",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Refresh failed:", response.status, errorData);
      throw new Error(`Refresh failed: ${response.status}`);
    }

    const refreshedTokens = await response.json();
    console.log("✅ Token refreshed successfully");

    const expiresIn = refreshedTokens?.expiresIn || 900;
    const accessTokenExpires = Date.now() + expiresIn * 1000;

    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      refreshToken: refreshedTokens.refreshToken || token.refreshToken, // Garder l'ancien si pas de nouveau
      accessTokenExpires,
      error: undefined, // Nettoyer l'erreur précédente
    };
  } catch (error) {
    console.error(
      "❌ Erreur lors du rafraîchissement du token d'accès:",
      error
    );

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const { handlers, auth } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(buildControlApiUrl("/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              tenantSlug: (credentials as any).tenantSlug || undefined,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error("❌ Login failed:", res.status, errorData);
            return null;
          }

          const data = await res.json();

          // Vérifier que nous avons les tokens nécessaires
          if (!data?.accessToken) {
            console.error("❌ No access token in response");
            return null;
          }

          const expiresIn = data?.expiresIn || 900;
          const accessToken = data?.accessToken;
          const refreshToken = data?.refreshToken;
          const accessTokenExpires = Date.now() + expiresIn * 1000;

          return {
            id: data.user?.id || "unknown",
            email: data.user?.email || credentials.email,
            name: data.user?.name || data.user?.firstName || "",
            accessToken,
            refreshToken,
            accessTokenExpires,
            user: data.user, // ✅ AJOUT: Garder les infos utilisateur
          } as any;
        } catch (error) {
          console.error("❌ Authorization error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // ✅ CALLBACK JWT AMÉLIORÉ COMME TON ANCIEN CODE
    async jwt({ token, user, trigger }) {
      // ✅ Premier login ou signin
      if (trigger === "signIn" && user) {
        console.log("✅ JWT: First login, storing tokens");
        return {
          ...token,
          accessToken: (user as any).accessToken,
          refreshToken: (user as any).refreshToken,
          accessTokenExpires: (user as any).accessTokenExpires,
          user: (user as any).user || user, // Stocker les infos utilisateur
          error: undefined,
        };
      }

      // ✅ Ignorer les updates de session pour garder le JWT petit
      if (trigger === "update") {
        return token;
      }

      // ✅ GESTION DE L'EXPIRATION (comme ton ancien code)
      const accessTokenExpires = (token as any).accessTokenExpires as
        | number
        | undefined;

      if (accessTokenExpires) {
        // Vérifier si le token expire dans les 60 prochaines secondes
        const willExpireInOneMinute = Date.now() > accessTokenExpires - 60_000;

        if (!willExpireInOneMinute) {
          // Token encore valide
          return token;
        }
      }

      // ✅ TOKEN EXPIRÉ OU VA EXPIRER - REFRESH
      console.log("🔄 JWT: Token expired or will expire soon, refreshing...");
      return refreshAccessToken(token);
    },

    // ✅ CALLBACK SESSION AMÉLIORÉ
    async session({ session, token }) {
      // ✅ Exposer les tokens à la session (sans le refresh token pour sécurité)
      (session as any).accessToken = (token as any).accessToken;
      (session as any).accessTokenExpires = (token as any).accessTokenExpires;

      // ✅ Exposer les infos utilisateur depuis le JWT
      const userFromToken = (token as any).user;
      if (userFromToken) {
        session.user = {
          ...session.user,
          ...userFromToken,
        };
      }

      // ✅ Exposer les erreurs pour gestion côté client
      if ((token as any).error) {
        (session as any).error = (token as any).error;
      }

      return session;
    },

    // ✅ REDIRECT CALLBACK (comme ton ancien code)
    async redirect({ url, baseUrl }) {
      try {
        // Permettre les URLs relatives
        if (url.startsWith("/")) return url;
        // Permettre les URLs absolues de même origine
        if (url.startsWith(baseUrl)) return url;
        // Gérer les callbackUrl double-encodées
        try {
          const decoded = decodeURIComponent(url);
          if (decoded.startsWith("/") || decoded.startsWith(baseUrl)) {
            return decoded;
          }
        } catch {}
      } catch {}
      return baseUrl;
    },
  },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/error",
  },
});

export const { GET, POST } = handlers;
