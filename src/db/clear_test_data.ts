import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

dotenv.config();

async function clearTestData() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(process.env.DATABASE_URL, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    console.log("🧹 Clearing customer/order test data...");

    await db.delete(schema.payments);
    console.log("✅ Payments cleared");

    await db.delete(schema.commissionLogs);
    console.log("✅ Commission logs cleared");

    await db.delete(schema.invoices);
    console.log("✅ Invoices cleared");

    await db.delete(schema.productUsageLogs);
    console.log("✅ Product usage logs cleared");

    await db.delete(schema.orderItemConsumables);
    console.log("✅ Order item consumables cleared");

    await db.delete(schema.serviceOrderProducts);
    console.log("✅ Service order products cleared");

    await db.delete(schema.serviceOrderItems);
    console.log("✅ Service order items cleared");

    await db.delete(schema.serviceOrders);
    console.log("✅ Service orders cleared");

    await db.delete(schema.appointments);
    console.log("✅ Appointments cleared");

    await db.delete(schema.customers);
    console.log("✅ Customers cleared");

    console.log("🎉 Test customer/order data cleared successfully");
  } catch (error) {
    console.error("❌ Failed to clear test data:", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

clearTestData();
