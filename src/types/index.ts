export type StaffRole = "SERVER" | "CASHIER" | "OWNER";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
};

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends SessionUser {}
}

// JWT type augmentation handled via casting in auth.config.ts
