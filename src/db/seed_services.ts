import { db } from "./index";
import { serviceCategories, services } from "./schema/services";
import { eq } from "drizzle-orm";

// Parse the menu data and create categories and services
export async function seedServices() {
  console.log("Starting to seed services...");

  // Define categories based on the menu structure
  const categories = [
    { name: "እጥበት", description: "Basic hair treatments" },
    { name: "ፍሪዝ", description: "Hair styling and treatments" },
    { name: "ፔስትራ", description: "Pasta and hair treatments" },
    { name: "ቅንድብ", description: "Braiding services" },
    { name: "ሬላክሰር", description: "Relaxer treatments" },
    { name: "ቀለም ጥቁር", description: "Black hair coloring" },
    { name: "ቤዝ", description: "Beige hair coloring" },
    { name: "ሃይ ላይት", description: "Highlight services" },
    { name: "ሁማን እና ረጅም ፀጉር", description: "Human and long hair treatments" },
    { name: "የልጆች ሽሩባ", description: "Children's braiding" },
    { name: "በፀጉር ያዋቁ ሽሩባ", description: "Hair braiding services" },
    { name: "ኬንያ", description: "Kenyan style braiding" },
    { name: "በሆ", description: "Special hair treatments" },
    { name: "ፍሬንች ከርል", description: "French curl services" },
    { name: "ሀበሻ", description: "Habesha services" },
    { name: "ዋክስ", description: "Waxing services" },
    { name: "አይላሽ", description: "Eyelash services" },
    { name: "ኔይል", description: "Nail services" },
  ];

  // Insert categories
  const insertedCategories = [];
  for (const category of categories) {
    // Check if category already exists
    const existing = await db.select().from(serviceCategories).where(eq(serviceCategories.name, category.name)).limit(1);
    
    if (existing.length === 0) {
      const [inserted] = await db.insert(serviceCategories).values(category).returning();
      insertedCategories.push(inserted);
      console.log(`Created category: ${category.name}`);
    } else {
      insertedCategories.push(existing[0]);
      console.log(`Category already exists: ${category.name}`);
    }
  }

  // Parse service data from the menu
  const serviceData = [
    // እጥበት
    { name: "እጥበት", price: 300, categoryName: "እጥበት" },
    { name: "ትሪትመንት እጥበት", price: 350, categoryName: "እጥበት" },
    { name: "ብሎው ድራይ", price: 200, categoryName: "እጥበት" },
    { name: "ካስክ", price: 500, categoryName: "እጥበት" },
    { name: "ሃማን ካስክ", price: 600, categoryName: "እጥበት" }, // Assumed price

    // ፍሪዝ
    { name: "ፍሪዝ በኮንዲሽነር", price: 400, categoryName: "ፍሪዝ" },
    { name: "ፍሪዝ በካንቱ", price: 850, categoryName: "ፍሪዝ" },
    { name: "ፍሪዝ በኮንዲት", price: 1000, categoryName: "ፍሪዝ" },
    { name: "ፍሪዝ በኮንዲት ሃማን", price: 1200, categoryName: "ፍሪዝ" },

    // ፔስትራ
    { name: "ፔስትራ በፀጉር", price: 700, categoryName: "ፔስትራ" },
    { name: "ፔስትራ በሃማን", price: 900, categoryName: "ፔስትራ" },
    { name: "ፔስትራ ሴንታቲክ", price: 950, categoryName: "ፔስትራ" },
    { name: "ፔስትራ ኮፍያ", price: 1000, categoryName: "ፔስትራ" },
    { name: "ሙሉ ፓኒተል", price: 1500, categoryName: "ፔስትራ" },
    { name: "ገማሽ ፓኒተል በስሬት", price: 2000, categoryName: "ፔስትራ" },
    { name: "ሌስ ግሉ", price: 2000, categoryName: "ፔስትራ" },

    // ቅንድብ
    { name: "ቅንድብ በምላጭ", price: 200, categoryName: "ቅንድብ" },
    { name: "ቅንድብ በክር", price: 300, categoryName: "ቅንድብ" },
    { name: "ቅንድብ በክር", price: 400, categoryName: "ቅንድብ" },
    { name: "ሙሉ ፊት በክር", price: 900, categoryName: "ቅንድብ" },
    { name: "ሂና", price: 400, categoryName: "ቅንድብ" },
    { name: "ቅንድብ መስተካከል እና ሂና", price: 700, categoryName: "ቅንድብ" },

    // ሬላክሰር
    { name: "ሬላክሰር ሪታች ከራሳቸው", price: 990, categoryName: "ሬላክሰር" },
    { name: "ሙሉ ሬላክሰር ከራሳቸው", price: 1500, categoryName: "ሬላክሰር" }, // Assumed price
    { name: "ሬላክሰር ሪታች ከቤቱ", price: 1200, categoryName: "ሬላክሰር" }, // Assumed price
    { name: "ሙሉ ሬላክሰር ከቤቱ", price: 1800, categoryName: "ሬላክሰር" }, // Assumed price

    // ቀለም ጥቁር
    { name: "ከራሳቸው ሪታች (ፍሮት)", price: 800, categoryName: "ቀለም ጥቁር" }, // Assumed price
    { name: "ከራሳቸው ሙሉ", price: 1200, categoryName: "ቀለም ጥቁር" }, // Assumed price
    { name: "ከቤቱ ሪታች", price: 1000, categoryName: "ቀለም ጥቁር" }, // Assumed price
    { name: "ከቤቱ ሙሉ", price: 1500, categoryName: "ቀለም ጥቁር" }, // Assumed price

    // ቤዝ
    { name: "ከራሳቸው ሪታች", price: 900, categoryName: "ቤዝ" }, // Assumed price
    { name: "ከራሳቸው ሙሉ", price: 1300, categoryName: "ቤዝ" }, // Assumed price
    { name: "ከቤቱ ሪታች", price: 1100, categoryName: "ቤዝ" }, // Assumed price
    { name: "ከቤቱ ሙሉ", price: 1600, categoryName: "ቤዝ" }, // Assumed price

    // ሃይ ላይት
    { name: "ከራሳቸው ሪታች", price: 1000, categoryName: "ሃይ ላይት" }, // Assumed price
    { name: "ከራሳቸው ሙሉ", price: 1400, categoryName: "ሃይ ላይት" }, // Assumed price
    { name: "ከቤቱ ሪታች", price: 1200, categoryName: "ሃይ ላይት" }, // Assumed price
    { name: "ከቤቱ ሙሉ", price: 1700, categoryName: "ሃይ ላይት" }, // Assumed price

    // ሁማን እና ረጅም ፀጉር
    { name: "ጥቁር", price: 500, categoryName: "ሁማን እና ረጅም ፀጉር" }, // Assumed price
    { name: "ቤዝ", price: 600, categoryName: "ሁማን እና ረጅም ፀጉር" }, // Assumed price
    { name: "ሃይ ላይት", price: 700, categoryName: "ሁማን እና ረጅም ፀጉር" }, // Assumed price

    // የልጆች ሽሩባ
    { name: "የልጆች ሽሩባ በዲዛይን", price: 650, categoryName: "የልጆች ሽሩባ" },
    { name: "ጬሌ", price: 500, categoryName: "የልጆች ሽሩባ" },
    { name: "የልጆች ሽሩባ በአንድ ዊግ", price: 900, categoryName: "የልጆች ሽሩባ" },
    { name: "በሁለት ዊግ", price: 1200, categoryName: "የልጆች ሽሩባ" },

    // በፀጉር ያዋቁ ሽሩባ
    { name: "በፀጉር ወደ ታች", price: 650, categoryName: "በፀጉር ያዋቁ ሽሩባ" },
    { name: "በፀጉር ቁጥጥር", price: 800, categoryName: "በፀጉር ያዋቁ ሽሩባ" },
    { name: "በፀጉር ትዊስት", price: 900, categoryName: "በፀጉር ያዋቁ ሽሩባ" },

    // ኬንያ
    { name: "ኬንያ ዊግ", price: 300, categoryName: "ኬንያ" },
    { name: "ወደታች በኬንያ ዊግ", price: 300, categoryName: "ኬንያ" },
    { name: "ቁጥጥር በኬንያ ዊግ", price: 300, categoryName: "ኬንያ" },
    { name: "ትዊስት በኬንያ ዊግ", price: 350, categoryName: "ኬንያ" },

    // በሆ
    { name: "በሆ በኬንያ ዊግ", price: 350, categoryName: "በሆ" },
    { name: "በሆ ሚወጣ ፀጉር", price: 2000, categoryName: "በሆ" },

    // ፍሬንች ከርል
    { name: "ፍሬንች ከርል የእጅ", price: 2000, categoryName: "ፍሬንች ከርል" },
    { name: "ፍሬንች ከርል ዊግ", price: 3000, categoryName: "ፍሬንች ከርል" },
    { name: "ፍሬንች አንድ ጭማሬ ዊግ", price: 750, categoryName: "ፍሬንች ከርል" },
    { name: "ፍሬንች ሁለት ጭማሬ ዊግ", price: 1500, categoryName: "ፍሬንች ከርል" },
    { name: "ፓሽን ትዊስት እና ኪንኪ ከርል", price: 1000, categoryName: "ፍሬንች ከርል" }, // Assumed price
    { name: "የጃጅ", price: 2000, categoryName: "ፍሬንች ከርል" },
    { name: "የእጅ", price: 1500, categoryName: "ፍሬንች ከርል" }, // Assumed price
    { name: "ለዊጉ", price: 3500, categoryName: "ፍሬንች ከርል" },
    { name: "ስፌት", price: 900, categoryName: "ፍሬንች ከርል" },

    // ሀበሻ
    { name: "አልባስ", price: 1200, categoryName: "ሀበሻ" },
    { name: "ጋሜ", price: 1500, categoryName: "ሀበሻ" },
    { name: "ዱላ በፍሬ (Pc)", price: 50, categoryName: "ሀበሻ" },
    { name: "ልዋም", price: 3500, categoryName: "ሀበሻ" },
    { name: "ዳልድ", price: 3000, categoryName: "ሀበሻ" },

    // ዋክስ
    { name: "ብብት", price: 600, categoryName: "ዋክስ" },
    { name: "ግማሽ እግር", price: 1000, categoryName: "ዋክስ" },
    { name: "ሙሉ እግር", price: 2300, categoryName: "ዋክስ" },
    { name: "ግማሽ እጅ", price: 800, categoryName: "ዋክስ" },
    { name: "ሙሉ እጅ", price: 1200, categoryName: "ዋክስ" },

    // አይላሽ
    { name: "አይላሽ ዋን ባይ ዋን", price: 4000, categoryName: "አይላሽ" },
    { name: "አይላሽ ስሪ ዋን", price: 2700, categoryName: "አይላሽ" },
    { name: "አይላሽ ችሪ ሜድ ፍን", price: 4000, categoryName: "አይላሽ" },
    { name: "ክላስተር ላሽ", price: 1500, categoryName: "አይላሽ" },

    // ኔይል
    { name: "ሚኒ ኪያር", price: 600, categoryName: "ኔይል" },
    { name: "ኖርማል ፐይዲ ኪያር", price: 1200, categoryName: "ኔይል" },
    { name: "ስፔሻል ፐይዲ ኪያር", price: 2000, categoryName: "ኔይል" },
    { name: "ልጥፍ", price: 600, categoryName: "ኔይል" },
    { name: "ሺላክ", price: 600, categoryName: "ኔይል" },
    { name: "ጄል ሙሌት", price: 1300, categoryName: "ኔይል" },
  ];

  // Insert services
  for (const service of serviceData) {
    const category = insertedCategories.find(cat => cat.name === service.categoryName);
    if (!category) {
      console.error(`Category not found: ${service.categoryName}`);
      continue;
    }

    // Check if service already exists
    const existing = await db.select().from(services).where(eq(services.name, service.name)).limit(1);
    
    if (existing.length === 0) {
      // Estimate duration based on price (simple heuristic)
      let durationMinutes = 30;
      if (service.price < 500) durationMinutes = 30;
      else if (service.price < 1000) durationMinutes = 45;
      else if (service.price < 2000) durationMinutes = 60;
      else if (service.price < 3000) durationMinutes = 90;
      else durationMinutes = 120;

      await db.insert(services).values({
        name: service.name,
        categoryId: category.id,
        basePrice: service.price.toString(),
        durationMinutes,
        isActive: true,
      });
      console.log(`Created service: ${service.name} - ${service.price} ETB`);
    } else {
      console.log(`Service already exists: ${service.name}`);
    }
  }

  console.log("Services seeding completed!");
}

// Run the seed function
seedServices().catch(console.error);
