import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { authConfig } from "@/lib/auth.config";
import type { SessionUser } from "@/types";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const [staffMember] = await db
          .select()
          .from(staff)
          .where(eq(staff.email, credentials.email as string))
          .limit(1);

        if (!staffMember || !staffMember.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          staffMember.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: staffMember.id,
          email: staffMember.email,
          firstName: staffMember.firstName,
          lastName: staffMember.lastName,
          role: staffMember.role,
        } as SessionUser;
      },
    }),
  ],
});
