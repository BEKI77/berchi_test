import type { NextAuthConfig } from "next-auth";
import type { SessionUser } from "@/types";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — one shift
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email!;
        token.firstName = (user as SessionUser).firstName;
        token.lastName = (user as SessionUser).lastName;
        token.role = (user as SessionUser).role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        email: token.email as string,
        firstName: token.firstName as string,
        lastName: token.lastName as string,
        role: token.role as SessionUser["role"],
      };
      return session;
    },
  },
  providers: [], // Providers are added in the full auth.ts (not edge-compatible)
};
