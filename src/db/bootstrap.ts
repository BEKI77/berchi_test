// First-run setup for a real installation (the cashier PC).
//
// Unlike seed.ts, this creates no demo staff, no demo customers and no shared
// password. It makes the one account needed to log in, plus the settings row the
// app reads, and nothing else -- the salon's own services, staff and prices are
// entered through the admin screens.
//
// Safe to run on every deploy: it only fills in what is missing and never
// touches an existing owner's password.
//
//   OWNER_EMAIL=... OWNER_PASSWORD=... npx tsx src/db/bootstrap.ts
//
// Run the migrations first. Roles and permissions are NOT created by them, so
// this seeds those too: without them every permission check fails, and even the
// owner is refused everything. The seeder only ever adds, so repeating it is
// harmless and a redeploy picks up any newly defined permissions.
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { toBasisPoints } from "../lib/money";
import { seedPermissions } from "./seed_permissions";

dotenv.config();

const MIN_PASSWORD_LENGTH = 10;
const REFUSED_PASSWORDS = new Set(["password123", "changeme", "change-me-now", "berchi_secret"]);

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;

  await seedPermissions();

  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    const [existingOwner] = await db
      .select({ id: schema.staff.id })
      .from(schema.staff)
      .where(eq(schema.staff.role, "OWNER"))
      .limit(1);

    if (existingOwner) {
      console.log("Owner account already exists - leaving it as it is.");
    } else {
      if (!email || !password) {
        throw new Error("No owner account yet: set OWNER_EMAIL and OWNER_PASSWORD to create one.");
      }
      if (password.length < MIN_PASSWORD_LENGTH || REFUSED_PASSWORDS.has(password.toLowerCase())) {
        throw new Error(
          `OWNER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters and not a well-known default.`
        );
      }

      await db.insert(schema.staff).values({
        firstName: process.env.OWNER_FIRST_NAME?.trim() || "Owner",
        lastName: process.env.OWNER_LAST_NAME?.trim() || "Account",
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "OWNER",
        commissionRate: 0,
        isActive: true,
      });
      console.log(`Owner account created: ${email}`);
    }

    const [existingSettings] = await db.select({ id: schema.salonSettings.id }).from(schema.salonSettings).limit(1);
    if (!existingSettings) {
      await db.insert(schema.salonSettings).values({
        salonName: process.env.SALON_NAME?.trim() || "Berchi Salon",
        taxRate: toBasisPoints(15),
        currency: "ETB",
        receiptsEnabled: true,
      });
      console.log("Salon settings created (edit them in the admin screens).");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
