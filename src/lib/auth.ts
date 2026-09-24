import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const username = String(creds?.username ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!username || !password) return null;
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.active) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: String(user.id),
          name: user.name,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isLogin = request.nextUrl.pathname.startsWith("/login");
      if (isLogin) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.username = user.username;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      session.user.role = token.role;
      return session;
    },
  },
});

/** Role helpers used by API routes and server components. */
export const ROLE_RANK = { cashier: 1, manager: 2, admin: 3 } as const;
export function atLeast(role: string, min: keyof typeof ROLE_RANK) {
  return (ROLE_RANK as Record<string, number>)[role] >= ROLE_RANK[min];
}
