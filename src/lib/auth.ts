import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { authConfig } from "@/lib/auth.config";
import { pinLoginEnabled, verifyStaffPin } from "@/lib/pin";
import type { SessionUser } from "@/types";

/**
 * A refused PIN. The `code` travels back to the tablet screen, which uses it to
 * say "3 tries left" or "locked" instead of a bare "wrong".
 */
class PinSignInError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    // The shared stylist tablet: pick your name, enter your PIN. Off unless
    // ENABLE_PIN_LOGIN=true, and it can only ever sign in an active stylist.
    Credentials({
      id: "pin",
      name: "PIN",
      credentials: {
        staffId: { label: "Stylist", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        if (!pinLoginEnabled()) return null;

        const result = await verifyStaffPin(credentials?.staffId, credentials?.pin);
        if (result.status === "ok") return result.user;
        if (result.status === "locked") throw new PinSignInError("pin_locked");
        if (result.status === "wrong") throw new PinSignInError(`pin_wrong_${result.triesLeft}`);
        return null;
      },
    }),
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
