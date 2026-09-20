import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "./schema";
import { toSantim, toBasisPoints } from "../lib/money";

dotenv.config();

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    console.log("🌱 Seeding database...");

    // ============================================================
    // STAFF (2 Servers, 1 Cashier, 1 Owner)
    // ============================================================
    const passwordHash = await bcrypt.hash("password123", 10);

    const staffData = [
      { firstName: "Sara", lastName: "Berchi", email: "owner@berchi.com", passwordHash, phone: "+251911000001", role: "OWNER" as const, commissionRate: "0", isActive: true },
      { firstName: "Hana", lastName: "Tadesse", email: "server1@berchi.com", passwordHash, phone: "+251911000002", role: "SERVER" as const, commissionRate: "15", isActive: true },
      { firstName: "Liya", lastName: "Kebede", email: "server2@berchi.com", passwordHash, phone: "+251911000003", role: "SERVER" as const, commissionRate: "15", isActive: true },
      { firstName: "Meron", lastName: "Alemu", email: "cashier@berchi.com", passwordHash, phone: "+251911000004", role: "CASHIER" as const, commissionRate: "0", isActive: true },
    ];

    for (const s of staffData) {
      const [existing] = await db.select().from(schema.staff).where(eq(schema.staff.email, s.email)).limit(1);
      if (!existing) {
        await db.insert(schema.staff).values({
          ...s,
          commissionRate: toBasisPoints(s.commissionRate),
        });
      }
    }

    // Demo PINs for the shared-tablet sign-in. Only fills in a missing PIN.
    const demoPins: Record<string, string> = { "server1@berchi.com": "2468", "server2@berchi.com": "1357" };
    for (const [email, pin] of Object.entries(demoPins)) {
      await db
        .update(schema.staff)
        .set({ pinHash: await bcrypt.hash(pin, 10) })
        .where(and(eq(schema.staff.email, email), isNull(schema.staff.pinHash)));
    }

    console.log("✅ Staff created");

    // ============================================================
    // SERVICE CATEGORIES + SERVICES
    // ============================================================
    const categoryData = [
      { name: "Hair", description: "Hair styling, cutting, and treatment services" },
      { name: "Nails", description: "Manicure, pedicure, and nail art services" },
      { name: "Makeup", description: "Professional makeup services" },
      { name: "Skin Care", description: "Facial treatments and skin care" },
      { name: "Spa", description: "Relaxation and body treatments" },
    ];

    const catIds: Record<string, string> = {};
    for (const cat of categoryData) {
      const [existing] = await db.select().from(schema.serviceCategories).where(eq(schema.serviceCategories.name, cat.name)).limit(1);
      if (existing) {
        catIds[cat.name] = existing.id;
      } else {
        const [created] = await db.insert(schema.serviceCategories).values(cat).returning();
        catIds[cat.name] = created.id;
      }
    }

    const servicesData = [
      { name: "Women's Haircut", categoryId: catIds["Hair"], basePrice: "500", durationMinutes: 45 },
      { name: "Men's Haircut", categoryId: catIds["Hair"], basePrice: "300", durationMinutes: 30 },
      { name: "Hair Coloring", categoryId: catIds["Hair"], basePrice: "1500", durationMinutes: 90 },
      { name: "Hair Straightening", categoryId: catIds["Hair"], basePrice: "2000", durationMinutes: 120 },
      { name: "Wig Installation", categoryId: catIds["Hair"], basePrice: "1000", durationMinutes: 60 },
      { name: "Braiding", categoryId: catIds["Hair"], basePrice: "800", durationMinutes: 90 },
      { name: "Basic Manicure", categoryId: catIds["Nails"], basePrice: "300", durationMinutes: 30 },
      { name: "Gel Manicure", categoryId: catIds["Nails"], basePrice: "500", durationMinutes: 45 },
      { name: "Basic Pedicure", categoryId: catIds["Nails"], basePrice: "400", durationMinutes: 40 },
      { name: "Nail Art", categoryId: catIds["Nails"], basePrice: "700", durationMinutes: 60 },
      { name: "Bridal Makeup", categoryId: catIds["Makeup"], basePrice: "3000", durationMinutes: 90 },
      { name: "Party Makeup", categoryId: catIds["Makeup"], basePrice: "1500", durationMinutes: 60 },
      { name: "Basic Facial", categoryId: catIds["Skin Care"], basePrice: "800", durationMinutes: 45 },
      { name: "Deep Cleansing Facial", categoryId: catIds["Skin Care"], basePrice: "1200", durationMinutes: 60 },
      { name: "Full Body Massage", categoryId: catIds["Spa"], basePrice: "1500", durationMinutes: 60 },
    ];

    for (const svc of servicesData) {
      await db
        .insert(schema.services)
        .values({ ...svc, basePrice: toSantim(svc.basePrice) })
        .onConflictDoNothing();
    }

    console.log("✅ Services created");

    // ============================================================
    // PRODUCT CATEGORIES + PRODUCTS
    // ============================================================
    const prodCatData = [
      { name: "Hair Products", description: "Shampoos, conditioners, and treatments" },
      { name: "Nail Products", description: "Nail polish, removers, and tools" },
      { name: "Skin Products", description: "Moisturizers, cleansers, and treatments" },
      { name: "Makeup Products", description: "Foundations, lipsticks, and cosmetics" },
    ];

    const prodCatIds: Record<string, string> = {};
    for (const cat of prodCatData) {
      const [existing] = await db.select().from(schema.productCategories).where(eq(schema.productCategories.name, cat.name)).limit(1);
      if (existing) {
        prodCatIds[cat.name] = existing.id;
      } else {
        const [created] = await db.insert(schema.productCategories).values(cat).returning();
        prodCatIds[cat.name] = created.id;
      }
    }

    const productsData = [
      { name: "Shampoo 500ml", sku: "HP-001", categoryId: prodCatIds["Hair Products"], costPrice: "150", sellPrice: "300", usagePrice: "50", quantityOnHand: 25, reorderLevel: 5 },
      { name: "Conditioner 500ml", sku: "HP-002", categoryId: prodCatIds["Hair Products"], costPrice: "180", sellPrice: "350", usagePrice: "50", quantityOnHand: 20, reorderLevel: 5 },
      { name: "Hair Color Kit", sku: "HP-003", categoryId: prodCatIds["Hair Products"], costPrice: "400", sellPrice: "0", usagePrice: "400", quantityOnHand: 15, reorderLevel: 3 },
      { name: "Hair Serum", sku: "HP-004", categoryId: prodCatIds["Hair Products"], costPrice: "200", sellPrice: "450", usagePrice: "80", quantityOnHand: 18, reorderLevel: 5 },
      { name: "Heat Protectant Spray", sku: "HP-005", categoryId: prodCatIds["Hair Products"], costPrice: "250", sellPrice: "500", usagePrice: "60", quantityOnHand: 12, reorderLevel: 3 },
      { name: "Hair Gel", sku: "HP-006", categoryId: prodCatIds["Hair Products"], costPrice: "100", sellPrice: "200", usagePrice: "30", quantityOnHand: 30, reorderLevel: 5 },
      { name: "Gel Nail Polish", sku: "NP-001", categoryId: prodCatIds["Nail Products"], costPrice: "120", sellPrice: "0", usagePrice: "120", quantityOnHand: 40, reorderLevel: 10 },
      { name: "Nail Polish Remover", sku: "NP-002", categoryId: prodCatIds["Nail Products"], costPrice: "80", sellPrice: "150", usagePrice: "30", quantityOnHand: 15, reorderLevel: 5 },
      { name: "Nail Tips (pack)", sku: "NP-003", categoryId: prodCatIds["Nail Products"], costPrice: "200", sellPrice: "0", usagePrice: "200", quantityOnHand: 10, reorderLevel: 3 },
      { name: "Cuticle Oil", sku: "NP-004", categoryId: prodCatIds["Nail Products"], costPrice: "90", sellPrice: "180", usagePrice: "40", quantityOnHand: 20, reorderLevel: 5 },
      { name: "Acrylic Powder", sku: "NP-005", categoryId: prodCatIds["Nail Products"], costPrice: "300", sellPrice: "0", usagePrice: "150", quantityOnHand: 8, reorderLevel: 3 },
      { name: "Face Cleanser", sku: "SP-001", categoryId: prodCatIds["Skin Products"], costPrice: "200", sellPrice: "400", usagePrice: "60", quantityOnHand: 15, reorderLevel: 5 },
      { name: "Moisturizer", sku: "SP-002", categoryId: prodCatIds["Skin Products"], costPrice: "250", sellPrice: "500", usagePrice: "70", quantityOnHand: 12, reorderLevel: 3 },
      { name: "Sunscreen SPF50", sku: "SP-003", categoryId: prodCatIds["Skin Products"], costPrice: "300", sellPrice: "600", usagePrice: "80", quantityOnHand: 10, reorderLevel: 3 },
      { name: "Face Mask (sheet)", sku: "SP-004", categoryId: prodCatIds["Skin Products"], costPrice: "50", sellPrice: "100", usagePrice: "50", quantityOnHand: 50, reorderLevel: 10 },
      { name: "Foundation", sku: "MP-001", categoryId: prodCatIds["Makeup Products"], costPrice: "400", sellPrice: "800", usagePrice: "100", quantityOnHand: 10, reorderLevel: 3 },
      { name: "Lipstick", sku: "MP-002", categoryId: prodCatIds["Makeup Products"], costPrice: "150", sellPrice: "350", usagePrice: "50", quantityOnHand: 20, reorderLevel: 5 },
      { name: "Mascara", sku: "MP-003", categoryId: prodCatIds["Makeup Products"], costPrice: "200", sellPrice: "450", usagePrice: "60", quantityOnHand: 15, reorderLevel: 3 },
      { name: "Eye Shadow Palette", sku: "MP-004", categoryId: prodCatIds["Makeup Products"], costPrice: "500", sellPrice: "1000", usagePrice: "100", quantityOnHand: 8, reorderLevel: 2 },
      { name: "Setting Spray", sku: "MP-005", categoryId: prodCatIds["Makeup Products"], costPrice: "250", sellPrice: "500", usagePrice: "50", quantityOnHand: 12, reorderLevel: 3 },
    ];

    for (const prod of productsData) {
      const [existing] = await db.select().from(schema.products).where(eq(schema.products.sku, prod.sku)).limit(1);
      if (!existing) {
        await db.insert(schema.products).values({
          ...prod,
          costPrice: toSantim(prod.costPrice),
          sellPrice: toSantim(prod.sellPrice),
          usagePrice: toSantim(prod.usagePrice),
        });
      }
    }

    console.log("✅ Products created");

    // ============================================================
    // CUSTOMERS
    // ============================================================
    const customersData = [
      { firstName: "Abeba", lastName: "Haile", phone: "+251912000001", email: "abeba@email.com" },
      { firstName: "Tigist", lastName: "Worku", phone: "+251912000002", email: "tigist@email.com" },
      { firstName: "Bethlehem", lastName: "Getachew", phone: "+251912000003", email: "bethlehem@email.com" },
      { firstName: "Selam", lastName: "Tesfaye", phone: "+251912000004", email: "selam@email.com" },
      { firstName: "Frehiwot", lastName: "Assefa", phone: "+251912000005", email: "frehiwot@email.com" },
    ];

    for (const cust of customersData) {
      const [existing] = await db.select().from(schema.customers).where(eq(schema.customers.phone, cust.phone)).limit(1);
      if (!existing) {
        await db.insert(schema.customers).values(cust);
      }
    }

    console.log("✅ Customers created");

    // ============================================================
    // SALON SETTINGS
    // ============================================================
    const [existingSettings] = await db.select().from(schema.salonSettings).limit(1);
    if (!existingSettings) {
      await db.insert(schema.salonSettings).values({
        salonName: "Berchi Salon",
        address: "Addis Ababa, Ethiopia",
        phone: "+251911000000",
        taxRate: toBasisPoints(15),
        currency: "ETB",
        receiptsEnabled: true,
        businessHours: JSON.stringify({
          monday: { open: "09:00", close: "20:00" },
          tuesday: { open: "09:00", close: "20:00" },
          wednesday: { open: "09:00", close: "20:00" },
          thursday: { open: "09:00", close: "20:00" },
          friday: { open: "09:00", close: "20:00" },
          saturday: { open: "09:00", close: "18:00" },
          sunday: { open: "closed", close: "closed" },
        }),
      });
    }

    console.log("✅ Salon settings created");

    console.log("\n🎉 Seed completed!");
    console.log("\n📋 Login credentials (all passwords: password123):");
    console.log("   Owner:   owner@berchi.com");
    console.log("   Server1: server1@berchi.com   (tablet PIN 2468)");
    console.log("   Server2: server2@berchi.com   (tablet PIN 1357)");
    console.log("   Cashier: cashier@berchi.com");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
