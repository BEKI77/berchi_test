import dotenv from "dotenv";
dotenv.config();

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("🧹 Deactivating old demo services and categories...");

    // Deactivate all existing services (can't delete due to FK constraints from orders)
    await prisma.service.updateMany({ data: { isActive: false } });
    // Deactivate all existing service categories
    await prisma.serviceCategory.updateMany({ data: { isActive: false } });

    console.log("✅ Old data deactivated\n");

    // ============================================================
    // CATEGORIES
    // ============================================================
    const categories = [
      { name: "እጥበት", description: "የፀጉር እጥበት እና ብሎው ድራይ አገልግሎቶች" },
      { name: "ፍሪዝ", description: "የፀጉር ፍሪዝ አገልግሎቶች" },
      { name: "ፔስትራ", description: "ፔስትራ እና ፓኒተል አገልግሎቶች" },
      { name: "ቅንድብ", description: "የቅንድብ፣ ሂና እና ክር አገልግሎቶች" },
      { name: "ሬላክሰር", description: "የፀጉር ሬላክሰር አገልግሎቶች" },
      { name: "ቀለም ጥቁር", description: "ጥቁር ቀለም አገልግሎቶች" },
      { name: "ቤዝ", description: "ቤዝ ቀለም አገልግሎቶች" },
      { name: "ሃይ ላይት", description: "ሃይ ላይት ቀለም አገልግሎቶች" },
      { name: "ሁማን እና ረጅም ፀጉር", description: "ለሁማን እና ረጅም ፀጉር ቀለም አገልግሎቶች" },
      { name: "የልጆች ሽሩባ", description: "የልጆች ሽሩባ አገልግሎቶች" },
      { name: "በፀጉር ያዋቁ ሽሩባ", description: "በፀጉር የተዋቀረ ሽሩባ አገልግሎቶች" },
      { name: "ኬንያ", description: "ኬንያ ዊግ አገልግሎቶች" },
      { name: "በሆ", description: "በሆ ስታይል አገልግሎቶች" },
      { name: "ፍሬንች ከርል", description: "ፍሬንች ከርል እና ትዊስት አገልግሎቶች" },
      { name: "ሀበሻ", description: "ባህላዊ የሀበሻ ፀጉር ስታይል" },
      { name: "ዋክስ", description: "የዋክስ አገልግሎቶች" },
      { name: "አይላሽ", description: "የአይላሽ አገልግሎቶች" },
      { name: "ኔይል", description: "የጥፍር አገልግሎቶች" },
    ];

    const catMap: Record<string, string> = {};
    for (const cat of categories) {
      const created = await prisma.serviceCategory.create({ data: cat });
      catMap[cat.name] = created.id;
      console.log(`  📁 ${cat.name}`);
    }
    console.log(`\n✅ ${categories.length} categories created\n`);

    // ============================================================
    // SERVICES
    // ============================================================
    type SvcInput = { name: string; categoryId: string; basePrice: number; durationMinutes: number; description?: string };

    const services: SvcInput[] = [
      // ── እጥበት ──
      { name: "እጥበት", categoryId: catMap["እጥበት"], basePrice: 300, durationMinutes: 30 },
      { name: "ትሪትመንት እጥበት", categoryId: catMap["እጥበት"], basePrice: 350, durationMinutes: 45 },
      { name: "ብሎው ድራይ", categoryId: catMap["እጥበት"], basePrice: 200, durationMinutes: 30 },
      { name: "ካስክ", categoryId: catMap["እጥበት"], basePrice: 500, durationMinutes: 45 },
      { name: "ሃማን ካስክ", categoryId: catMap["እጥበት"], basePrice: 999, durationMinutes: 60 },

      // ── ፍሪዝ ──
      { name: "ፍሪዝ በኮንዲሽነር", categoryId: catMap["ፍሪዝ"], basePrice: 400, durationMinutes: 60 },
      { name: "ፍሪዝ በካንቱ", categoryId: catMap["ፍሪዝ"], basePrice: 850, durationMinutes: 90 },
      { name: "ፍሪዝ በኮንዲት", categoryId: catMap["ፍሪዝ"], basePrice: 1000, durationMinutes: 90 },
      { name: "ፍሪዝ በኮንዲት ሃማን", categoryId: catMap["ፍሪዝ"], basePrice: 1200, durationMinutes: 120 },

      // ── ፔስትራ ──
      { name: "ፔስትራ በፀጉር", categoryId: catMap["ፔስትራ"], basePrice: 700, durationMinutes: 60 },
      { name: "ፔስትራ በሃማን", categoryId: catMap["ፔስትራ"], basePrice: 900, durationMinutes: 90 },
      { name: "ፔስትራ ሴንታቲክ", categoryId: catMap["ፔስትራ"], basePrice: 950, durationMinutes: 90 },
      { name: "ፔስትራ ኮፍያ", categoryId: catMap["ፔስትራ"], basePrice: 1000, durationMinutes: 90 },
      { name: "ሙሉ ፓኒተል", categoryId: catMap["ፔስትራ"], basePrice: 1500, durationMinutes: 120 },
      { name: "ገማሽ ፓኒተል በስሬት", categoryId: catMap["ፔስትራ"], basePrice: 2000, durationMinutes: 120 },
      { name: "ሌስ ግሉ", categoryId: catMap["ፔስትራ"], basePrice: 2000, durationMinutes: 90 },

      // ── ቅንድብ ──
      { name: "ቅንድብ በምላጭ", categoryId: catMap["ቅንድብ"], basePrice: 200, durationMinutes: 15 },
      { name: "ቅንድብ በክር", categoryId: catMap["ቅንድብ"], basePrice: 300, durationMinutes: 20 },
      { name: "ከንፈር በክር", categoryId: catMap["ቅንድብ"], basePrice: 400, durationMinutes: 15 },
      { name: "ሙሉ ፊት በክር", categoryId: catMap["ቅንድብ"], basePrice: 900, durationMinutes: 30 },
      { name: "ሂና", categoryId: catMap["ቅንድብ"], basePrice: 400, durationMinutes: 30 },
      { name: "ቅንድብ መስተካከል እና ሂና", categoryId: catMap["ቅንድብ"], basePrice: 700, durationMinutes: 45 },

      // ── ሬላክሰር ──
      { name: "ሬላክሰር ሪታች ከራሳቸው", categoryId: catMap["ሬላክሰር"], basePrice: 999, durationMinutes: 60 },
      { name: "ሙሉ ሬላክሰር ከራሳቸው", categoryId: catMap["ሬላክሰር"], basePrice: 999, durationMinutes: 90 },
      { name: "ሬላክሰር ሪታች ከቤቱ", categoryId: catMap["ሬላክሰር"], basePrice: 999, durationMinutes: 60 },
      { name: "ሙሉ ሬላክሰር ከቤቱ", categoryId: catMap["ሬላክሰር"], basePrice: 999, durationMinutes: 90 },

      // ── ቀለም ጥቁር ──
      { name: "ከራሳቸው ሪታች (ፍሮት)", categoryId: catMap["ቀለም ጥቁር"], basePrice: 999, durationMinutes: 60 },
      { name: "ከራሳቸው ሙሉ", categoryId: catMap["ቀለም ጥቁር"], basePrice: 999, durationMinutes: 90, description: "ቀለም ጥቁር" },
      { name: "ከቤቱ ሪታች", categoryId: catMap["ቀለም ጥቁር"], basePrice: 999, durationMinutes: 60, description: "ቀለም ጥቁር" },
      { name: "ከቤቱ ሙሉ", categoryId: catMap["ቀለም ጥቁር"], basePrice: 999, durationMinutes: 90, description: "ቀለም ጥቁር" },

      // ── ቤዝ ──
      { name: "ቤዝ ከራሳቸው ሪታች", categoryId: catMap["ቤዝ"], basePrice: 999, durationMinutes: 60 },
      { name: "ቤዝ ከራሳቸው ሙሉ", categoryId: catMap["ቤዝ"], basePrice: 999, durationMinutes: 90 },
      { name: "ቤዝ ከቤቱ ሪታች", categoryId: catMap["ቤዝ"], basePrice: 999, durationMinutes: 60 },
      { name: "ቤዝ ከቤቱ ሙሉ", categoryId: catMap["ቤዝ"], basePrice: 999, durationMinutes: 90 },

      // ── ሃይ ላይት ──
      { name: "ሃይ ላይት ከራሳቸው ሪታች", categoryId: catMap["ሃይ ላይት"], basePrice: 999, durationMinutes: 90 },
      { name: "ሃይ ላይት ከራሳቸው ሙሉ", categoryId: catMap["ሃይ ላይት"], basePrice: 999, durationMinutes: 120 },
      { name: "ሃይ ላይት ከቤቱ ሪታች", categoryId: catMap["ሃይ ላይት"], basePrice: 999, durationMinutes: 90 },
      { name: "ሃይ ላይት ከቤቱ ሙሉ", categoryId: catMap["ሃይ ላይት"], basePrice: 999, durationMinutes: 120 },

      // ── ሁማን እና ረጅም ፀጉር ──
      { name: "ጥቁር (ሁማን/ረጅም)", categoryId: catMap["ሁማን እና ረጅም ፀጉር"], basePrice: 999, durationMinutes: 90 },
      { name: "ቤዝ (ሁማን/ረጅም)", categoryId: catMap["ሁማን እና ረጅም ፀጉር"], basePrice: 999, durationMinutes: 90 },
      { name: "ሃይ ላይት (ሁማን/ረጅም)", categoryId: catMap["ሁማን እና ረጅም ፀጉር"], basePrice: 999, durationMinutes: 120 },

      // ── የልጆች ሽሩባ ──
      { name: "የልጆች ሽሩባ በዲዛይን", categoryId: catMap["የልጆች ሽሩባ"], basePrice: 650, durationMinutes: 60 },
      { name: "ጬሌ", categoryId: catMap["የልጆች ሽሩባ"], basePrice: 500, durationMinutes: 45 },
      { name: "የልጆች ሽሩባ በአንድ ዊግ", categoryId: catMap["የልጆች ሽሩባ"], basePrice: 900, durationMinutes: 60 },
      { name: "በሁለት ዊግ", categoryId: catMap["የልጆች ሽሩባ"], basePrice: 1200, durationMinutes: 90 },

      // ── በፀጉር ያዋቁ ሽሩባ ──
      { name: "በፀጉር ወደ ታች", categoryId: catMap["በፀጉር ያዋቁ ሽሩባ"], basePrice: 650, durationMinutes: 90 },
      { name: "በፀጉር ቁጥጥር", categoryId: catMap["በፀጉር ያዋቁ ሽሩባ"], basePrice: 800, durationMinutes: 120 },
      { name: "በፀጉር ትዊስት", categoryId: catMap["በፀጉር ያዋቁ ሽሩባ"], basePrice: 900, durationMinutes: 120 },

      // ── ኬንያ ──
      { name: "ኬንያ ዊግ", categoryId: catMap["ኬንያ"], basePrice: 300, durationMinutes: 30 },
      { name: "ወደታች በኬንያ ዊግ", categoryId: catMap["ኬንያ"], basePrice: 300, durationMinutes: 45 },
      { name: "ቁጥጥር በኬንያ ዊግ", categoryId: catMap["ኬንያ"], basePrice: 300, durationMinutes: 45 },
      { name: "ትዊስት በኬንያ ዊግ", categoryId: catMap["ኬንያ"], basePrice: 350, durationMinutes: 45 },

      // ── በሆ ──
      { name: "በሆ በኬንያ ዊግ", categoryId: catMap["በሆ"], basePrice: 350, durationMinutes: 45 },
      { name: "በሆ ሚወጣ ፀጉር", categoryId: catMap["በሆ"], basePrice: 2000, durationMinutes: 180 },

      // ── ፍሬንች ከርል ──
      { name: "ፍሬንች ከርል የእጅ", categoryId: catMap["ፍሬንች ከርል"], basePrice: 2000, durationMinutes: 180 },
      { name: "ፍሬንች ከርል ዊግ", categoryId: catMap["ፍሬንች ከርል"], basePrice: 3000, durationMinutes: 120 },
      { name: "ፍሬንች አንድ ጭማሬ ዊግ", categoryId: catMap["ፍሬንች ከርል"], basePrice: 750, durationMinutes: 60 },
      { name: "ፍሬንች ሁለት ጭማሬ ዊግ", categoryId: catMap["ፍሬንች ከርል"], basePrice: 1500, durationMinutes: 90 },
      { name: "ፓሽን ትዊስት እና ኪንኪ ከርል", categoryId: catMap["ፍሬንች ከርል"], basePrice: 999, durationMinutes: 180 },
      { name: "የጃጅ", categoryId: catMap["ፍሬንች ከርል"], basePrice: 2000, durationMinutes: 180 },
      { name: "የእጅ", categoryId: catMap["ፍሬንች ከርል"], basePrice: 999, durationMinutes: 180 },
      { name: "ለዊጉ", categoryId: catMap["ፍሬንች ከርል"], basePrice: 3500, durationMinutes: 120 },
      { name: "ስፌት", categoryId: catMap["ፍሬንች ከርል"], basePrice: 900, durationMinutes: 90 },

      // ── ሀበሻ ──
      { name: "አልባስ", categoryId: catMap["ሀበሻ"], basePrice: 1200, durationMinutes: 120 },
      { name: "ጋሜ", categoryId: catMap["ሀበሻ"], basePrice: 1500, durationMinutes: 150 },
      { name: "ዱላ በፍሬ (Pc)", categoryId: catMap["ሀበሻ"], basePrice: 50, durationMinutes: 15 },
      { name: "ልዋም", categoryId: catMap["ሀበሻ"], basePrice: 3500, durationMinutes: 180 },
      { name: "ዳልድ", categoryId: catMap["ሀበሻ"], basePrice: 3000, durationMinutes: 150 },

      // ── ዋክስ ──
      { name: "ብብት", categoryId: catMap["ዋክስ"], basePrice: 600, durationMinutes: 20 },
      { name: "ግማሽ እግር", categoryId: catMap["ዋክስ"], basePrice: 1000, durationMinutes: 30 },
      { name: "ሙሉ እግር", categoryId: catMap["ዋክስ"], basePrice: 2300, durationMinutes: 45 },
      { name: "ግማሽ እጅ", categoryId: catMap["ዋክስ"], basePrice: 800, durationMinutes: 20 },
      { name: "ሙሉ እጅ", categoryId: catMap["ዋክስ"], basePrice: 1200, durationMinutes: 30 },

      // ── አይላሽ ──
      { name: "አይላሽ ዋን ባይ ዋን", categoryId: catMap["አይላሽ"], basePrice: 4000, durationMinutes: 120 },
      { name: "አይላሽ ስሪ ዋን", categoryId: catMap["አይላሽ"], basePrice: 2700, durationMinutes: 90 },
      { name: "አይላሽ ችሪ ሜድ ፍን", categoryId: catMap["አይላሽ"], basePrice: 4000, durationMinutes: 120 },
      { name: "ክላስተር ላሽ", categoryId: catMap["አይላሽ"], basePrice: 1500, durationMinutes: 60 },

      // ── ኔይል ──
      { name: "ሚኒ ኪያር", categoryId: catMap["ኔይል"], basePrice: 600, durationMinutes: 30 },
      { name: "ኖርማል ፐይዲ ኪያር", categoryId: catMap["ኔይል"], basePrice: 1200, durationMinutes: 60 },
      { name: "ስፔሻል ፐይዲ ኪያር", categoryId: catMap["ኔይል"], basePrice: 2000, durationMinutes: 90 },
      { name: "ልጥፍ", categoryId: catMap["ኔይል"], basePrice: 600, durationMinutes: 30 },
      { name: "ሺላክ", categoryId: catMap["ኔይል"], basePrice: 600, durationMinutes: 45 },
      { name: "ጄል ሙሌት", categoryId: catMap["ኔይል"], basePrice: 1300, durationMinutes: 60 },
    ];

    let count = 0;
    for (const svc of services) {
      await prisma.service.create({ data: svc });
      count++;
    }

    console.log(`✅ ${count} services created across ${categories.length} categories`);
    console.log("\n🎉 Service seeding complete!");
    console.log("ℹ️  Services with price 999 need to be updated by the owner.");
  } catch (e) {
    console.error("❌ Error:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
