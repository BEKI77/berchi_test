import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  // Prisma v7: dynamic import for ESM-only generated client
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("🌱 Seeding database...");

    // ============================================================
    // STAFF (2 Servers, 1 Cashier, 1 Owner)
    // ============================================================
    const passwordHash = await bcrypt.hash("password123", 10);

  const owner = await prisma.staff.upsert({
    where: { email: "owner@berchi.com" },
    update: {},
    create: {
      firstName: "Sara",
      lastName: "Berchi",
      email: "owner@berchi.com",
      passwordHash,
      phone: "+251911000001",
      role: "OWNER",
      commissionRate: 0,
      isActive: true,
    },
  });

  const server1 = await prisma.staff.upsert({
    where: { email: "server1@berchi.com" },
    update: {},
    create: {
      firstName: "Hana",
      lastName: "Tadesse",
      email: "server1@berchi.com",
      passwordHash,
      phone: "+251911000002",
      role: "SERVER",
      commissionRate: 15.0,
      isActive: true,
    },
  });

  const server2 = await prisma.staff.upsert({
    where: { email: "server2@berchi.com" },
    update: {},
    create: {
      firstName: "Liya",
      lastName: "Kebede",
      email: "server2@berchi.com",
      passwordHash,
      phone: "+251911000003",
      role: "SERVER",
      commissionRate: 15.0,
      isActive: true,
    },
  });

  const cashier = await prisma.staff.upsert({
    where: { email: "cashier@berchi.com" },
    update: {},
    create: {
      firstName: "Meron",
      lastName: "Alemu",
      email: "cashier@berchi.com",
      passwordHash,
      phone: "+251911000004",
      role: "CASHIER",
      commissionRate: 0,
      isActive: true,
    },
  });

  console.log("✅ Staff created");

  // ============================================================
  // SERVICE CATEGORIES + SERVICES
  // ============================================================
  const hairCat = await prisma.serviceCategory.upsert({
    where: { name: "Hair" },
    update: {},
    create: { name: "Hair", description: "Hair styling, cutting, and treatment services" },
  });

  const nailsCat = await prisma.serviceCategory.upsert({
    where: { name: "Nails" },
    update: {},
    create: { name: "Nails", description: "Manicure, pedicure, and nail art services" },
  });

  const makeupCat = await prisma.serviceCategory.upsert({
    where: { name: "Makeup" },
    update: {},
    create: { name: "Makeup", description: "Professional makeup services" },
  });

  const skinCat = await prisma.serviceCategory.upsert({
    where: { name: "Skin Care" },
    update: {},
    create: { name: "Skin Care", description: "Facial treatments and skin care" },
  });

  const spaCat = await prisma.serviceCategory.upsert({
    where: { name: "Spa" },
    update: {},
    create: { name: "Spa", description: "Relaxation and body treatments" },
  });

  const services = [
    { name: "Women's Haircut", categoryId: hairCat.id, basePrice: 500, durationMinutes: 45 },
    { name: "Men's Haircut", categoryId: hairCat.id, basePrice: 300, durationMinutes: 30 },
    { name: "Hair Coloring", categoryId: hairCat.id, basePrice: 1500, durationMinutes: 90 },
    { name: "Hair Straightening", categoryId: hairCat.id, basePrice: 2000, durationMinutes: 120 },
    { name: "Wig Installation", categoryId: hairCat.id, basePrice: 1000, durationMinutes: 60 },
    { name: "Braiding", categoryId: hairCat.id, basePrice: 800, durationMinutes: 90 },
    { name: "Basic Manicure", categoryId: nailsCat.id, basePrice: 300, durationMinutes: 30 },
    { name: "Gel Manicure", categoryId: nailsCat.id, basePrice: 500, durationMinutes: 45 },
    { name: "Basic Pedicure", categoryId: nailsCat.id, basePrice: 400, durationMinutes: 40 },
    { name: "Nail Art", categoryId: nailsCat.id, basePrice: 700, durationMinutes: 60 },
    { name: "Bridal Makeup", categoryId: makeupCat.id, basePrice: 3000, durationMinutes: 90 },
    { name: "Party Makeup", categoryId: makeupCat.id, basePrice: 1500, durationMinutes: 60 },
    { name: "Basic Facial", categoryId: skinCat.id, basePrice: 800, durationMinutes: 45 },
    { name: "Deep Cleansing Facial", categoryId: skinCat.id, basePrice: 1200, durationMinutes: 60 },
    { name: "Full Body Massage", categoryId: spaCat.id, basePrice: 1500, durationMinutes: 60 },
  ];

  for (const svc of services) {
    await prisma.service.upsert({
      where: { id: svc.name }, // will fail unique — use create
      update: {},
      create: svc,
    }).catch(() =>
      prisma.service.create({ data: svc })
    );
  }

  console.log("✅ Services created");

  // ============================================================
  // PRODUCT CATEGORIES + PRODUCTS
  // ============================================================
  const hairProdCat = await prisma.productCategory.upsert({
    where: { name: "Hair Products" },
    update: {},
    create: { name: "Hair Products", description: "Shampoos, conditioners, and treatments" },
  });

  const nailProdCat = await prisma.productCategory.upsert({
    where: { name: "Nail Products" },
    update: {},
    create: { name: "Nail Products", description: "Nail polish, removers, and tools" },
  });

  const skinProdCat = await prisma.productCategory.upsert({
    where: { name: "Skin Products" },
    update: {},
    create: { name: "Skin Products", description: "Moisturizers, cleansers, and treatments" },
  });

  const makeupProdCat = await prisma.productCategory.upsert({
    where: { name: "Makeup Products" },
    update: {},
    create: { name: "Makeup Products", description: "Foundations, lipsticks, and cosmetics" },
  });

  const products = [
    { name: "Shampoo 500ml", sku: "HP-001", categoryId: hairProdCat.id, costPrice: 150, sellPrice: 300, usagePrice: 50, quantityOnHand: 25, reorderLevel: 5 },
    { name: "Conditioner 500ml", sku: "HP-002", categoryId: hairProdCat.id, costPrice: 180, sellPrice: 350, usagePrice: 50, quantityOnHand: 20, reorderLevel: 5 },
    { name: "Hair Color Kit", sku: "HP-003", categoryId: hairProdCat.id, costPrice: 400, sellPrice: 0, usagePrice: 400, quantityOnHand: 15, reorderLevel: 3 },
    { name: "Hair Serum", sku: "HP-004", categoryId: hairProdCat.id, costPrice: 200, sellPrice: 450, usagePrice: 80, quantityOnHand: 18, reorderLevel: 5 },
    { name: "Heat Protectant Spray", sku: "HP-005", categoryId: hairProdCat.id, costPrice: 250, sellPrice: 500, usagePrice: 60, quantityOnHand: 12, reorderLevel: 3 },
    { name: "Hair Gel", sku: "HP-006", categoryId: hairProdCat.id, costPrice: 100, sellPrice: 200, usagePrice: 30, quantityOnHand: 30, reorderLevel: 5 },
    { name: "Gel Nail Polish", sku: "NP-001", categoryId: nailProdCat.id, costPrice: 120, sellPrice: 0, usagePrice: 120, quantityOnHand: 40, reorderLevel: 10 },
    { name: "Nail Polish Remover", sku: "NP-002", categoryId: nailProdCat.id, costPrice: 80, sellPrice: 150, usagePrice: 30, quantityOnHand: 15, reorderLevel: 5 },
    { name: "Nail Tips (pack)", sku: "NP-003", categoryId: nailProdCat.id, costPrice: 200, sellPrice: 0, usagePrice: 200, quantityOnHand: 10, reorderLevel: 3 },
    { name: "Cuticle Oil", sku: "NP-004", categoryId: nailProdCat.id, costPrice: 90, sellPrice: 180, usagePrice: 40, quantityOnHand: 20, reorderLevel: 5 },
    { name: "Acrylic Powder", sku: "NP-005", categoryId: nailProdCat.id, costPrice: 300, sellPrice: 0, usagePrice: 150, quantityOnHand: 8, reorderLevel: 3 },
    { name: "Face Cleanser", sku: "SP-001", categoryId: skinProdCat.id, costPrice: 200, sellPrice: 400, usagePrice: 60, quantityOnHand: 15, reorderLevel: 5 },
    { name: "Moisturizer", sku: "SP-002", categoryId: skinProdCat.id, costPrice: 250, sellPrice: 500, usagePrice: 70, quantityOnHand: 12, reorderLevel: 3 },
    { name: "Sunscreen SPF50", sku: "SP-003", categoryId: skinProdCat.id, costPrice: 300, sellPrice: 600, usagePrice: 80, quantityOnHand: 10, reorderLevel: 3 },
    { name: "Face Mask (sheet)", sku: "SP-004", categoryId: skinProdCat.id, costPrice: 50, sellPrice: 100, usagePrice: 50, quantityOnHand: 50, reorderLevel: 10 },
    { name: "Foundation", sku: "MP-001", categoryId: makeupProdCat.id, costPrice: 400, sellPrice: 800, usagePrice: 100, quantityOnHand: 10, reorderLevel: 3 },
    { name: "Lipstick", sku: "MP-002", categoryId: makeupProdCat.id, costPrice: 150, sellPrice: 350, usagePrice: 50, quantityOnHand: 20, reorderLevel: 5 },
    { name: "Mascara", sku: "MP-003", categoryId: makeupProdCat.id, costPrice: 200, sellPrice: 450, usagePrice: 60, quantityOnHand: 15, reorderLevel: 3 },
    { name: "Eye Shadow Palette", sku: "MP-004", categoryId: makeupProdCat.id, costPrice: 500, sellPrice: 1000, usagePrice: 100, quantityOnHand: 8, reorderLevel: 2 },
    { name: "Setting Spray", sku: "MP-005", categoryId: makeupProdCat.id, costPrice: 250, sellPrice: 500, usagePrice: 50, quantityOnHand: 12, reorderLevel: 3 },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { sku: prod.sku! },
      update: {},
      create: prod,
    });
  }

  console.log("✅ Products created");

  // ============================================================
  // CUSTOMERS
  // ============================================================
  const customers = [
    { firstName: "Abeba", lastName: "Haile", phone: "+251912000001", email: "abeba@email.com" },
    { firstName: "Tigist", lastName: "Worku", phone: "+251912000002", email: "tigist@email.com" },
    { firstName: "Bethlehem", lastName: "Getachew", phone: "+251912000003", email: "bethlehem@email.com" },
    { firstName: "Selam", lastName: "Tesfaye", phone: "+251912000004", email: "selam@email.com" },
    { firstName: "Frehiwot", lastName: "Assefa", phone: "+251912000005", email: "frehiwot@email.com" },
  ];

  for (const cust of customers) {
    await prisma.customer.upsert({
      where: { phone: cust.phone },
      update: {},
      create: cust,
    });
  }

  console.log("✅ Customers created");

  // ============================================================
  // SALON SETTINGS
  // ============================================================
  const existingSettings = await prisma.salonSettings.findFirst();
  if (!existingSettings) {
    await prisma.salonSettings.create({
      data: {
        salonName: "Berchi Salon",
        address: "Addis Ababa, Ethiopia",
        phone: "+251911000000",
        taxRate: 15.0,
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
      },
    });
  }

    console.log("✅ Salon settings created");

    console.log("\n🎉 Seed completed!");
    console.log("\n📋 Login credentials (all passwords: password123):");
    console.log("   Owner:   owner@berchi.com");
    console.log("   Server1: server1@berchi.com");
    console.log("   Server2: server2@berchi.com");
    console.log("   Cashier: cashier@berchi.com");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
