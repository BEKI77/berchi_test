import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

dotenv.config();

async function resetAndSeedServices() {
  console.log("Starting to reset and seed services...");

  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    // Delete from dependent tables first (in correct order to avoid foreign key constraints)
    console.log("Deleting existing commission logs...");
    await db.delete(schema.commissionLogs);
    console.log("Deleted all commission logs");

    console.log("Deleting existing service order items...");
    await db.delete(schema.serviceOrderItems);
    console.log("Deleted all service order items");

    console.log("Deleting existing appointments...");
    await db.delete(schema.appointments);
    console.log("Deleted all appointments");

    console.log("Deleting existing services...");
    await db.delete(schema.services);
    console.log("Deleted all services");

    console.log("Deleting existing service categories...");
    await db.delete(schema.serviceCategories);
    console.log("Deleted all service categories");

    console.log("Database cleared successfully. Now seeding new services...");

    // Import and run the seed function
    const seedServicesModule = await import('./seed_services');
    await seedServicesModule.seedServices();

    console.log("Reset and seed completed successfully!");
  } catch (error) {
    console.error("Error during reset and seed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the reset and seed function
resetAndSeedServices().catch(console.error);
