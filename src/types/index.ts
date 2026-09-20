export type StaffRole = "SERVER" | "CASHIER" | "OWNER";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  /**
   * How this session was opened. "pin" is the shared stylist tablet, which is
   * signed out after sending a ticket or a few idle minutes; anything else
   * (including sessions that predate this field) is an ordinary sign-in.
   */
  signedInWith?: "password" | "pin";
};

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends SessionUser {}
}

// JWT type augmentation handled via casting in auth.config.ts
