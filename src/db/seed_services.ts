import { db } from "./index";
import { serviceCategories, services } from "./schema/services";
import { eq } from "drizzle-orm";
import { toSantim } from "../lib/money";

// Parse the menu data and create categories and services
export async function seedServices() {
  console.log("Starting to seed services...");

  // Define categories based on the menu structure
  const categories = [
    { name: "ፓስትራ", description: "Pastra hair styling and ponytail services" },
    { name: "ፀጉር የአዋቂ ሽሩባ", description: "Adult hair braiding and styling" },
    { name: "ኬንያ", description: "Kenya wig and extensions braiding" },
    {
      name: "ፍሬንች ከርል",
      description: "French curl extensions and wig services",
    },
    {
      name: "ቅንድብ",
      description: "Eyebrow shaping, threading, and facial hair removal",
    },
    {
      name: "የልጆች ሽሩባ",
      description: "Kids hair braiding and styled extensions",
    },
    {
      name: "ፖሽ ትዊስት እና ኪንኪ ከርል",
      description: "Posh twist and kinky curl styling",
    },
    { name: "ሀበሻ", description: "Traditional Ethiopian hair braiding styles" },
    {
      name: "ኔይል/ጥፍር/",
      description: "Manicure, pedicure, nail extensions, and gel services",
    },
    {
      name: "እጥበት",
      description: "Hair washing, treatments, blowing, and masks",
    },
    {
      name: "ቀለም",
      description: "Hair coloring services for frontals, roots, and full hair",
    },
    {
      name: "አይላሽ",
      description: "Eyelash extensions and premium lash services",
    },
    { name: "ፍሪዝ", description: "Freeze styling and conditioning treatments" },
    {
      name: "ሂዩማን እና ረጅም ፀጉር",
      description: "Human hair extensions and long hair coloring",
    },
    { name: "ቡህ", description: "Buh hair extension braiding" },
    { name: "ሃይ ላይት", description: "Full head and partial hair highlighting" },
    { name: "ሪላክሰር", description: "Hair relaxing and smoothing treatments" },
    { name: "ዋክስ", description: "Waxing services for body and facial hair" },
    { name: "ክሊፕ", description: "Clip-in hair extension services" },
    {
      name: "የወንዶች ፀጉር አስተካካይ",
      description: "Men's haircut, beard trimming, wash, and hair dye services",
    },
  ];

  // Insert categories
  const insertedCategories = [];
  for (const category of categories) {
    // Check if category already exists
    const existing = await db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.name, category.name))
      .limit(1);

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(serviceCategories)
        .values(category)
        .returning();
      insertedCategories.push(inserted);
      console.log(`Created category: ${category.name}`);
    } else {
      insertedCategories.push(existing[0]);
      console.log(`Category already exists: ${category.name}`);
    }
  }

  // Parse service data from the menu
  const serviceData = [
    { name: "ፓስትራ በፀጉር", price: 600, categoryName: "ፓስትራ" },
    { name: "ፓስትራ በሂዩማን", price: 800, categoryName: "ፓስትራ" },
    { name: "ፓስትራ ሲንቴቲክ", price: 1000, categoryName: "ፓስትራ" },
    { name: "ፓስትራ ኮፍያ", price: 1000, categoryName: "ፓስትራ" },
    { name: "ፓስትራ በክስ ሙሉ ፖኒቴል", price: 1500, categoryName: "ፓስትራ" },
    { name: "ፓስትራ በክስ ፖኒቴል", price: 1200, categoryName: "ፓስትራ" },
    { name: "ግማሽ ፖኒቴል በስፌት", price: 2000, categoryName: "ፓስትራ" },
    { name: "ሌስ ግሉ", price: 2000, categoryName: "ፓስትራ" },

    { name: "ፀጉር ወደ ታች", price: 650, categoryName: "ፀጉር የአዋቂ ሽሩባ" },
    { name: "ፀጉር ቁጥጥር", price: 800, categoryName: "ፀጉር የአዋቂ ሽሩባ" },
    { name: "ፀጉር ትዊስት", price: 900, categoryName: "ፀጉር የአዋቂ ሽሩባ" },

    { name: "ኬንያ ዊግ", price: 350, categoryName: "ኬንያ" },
    {
      name: "ወይ ታች በኬንያ ዊግ",
      price: 800,
      categoryName: "ኬንያ",
      description: "800+400 እያለ ይጨምራል",
    },
    {
      name: "ቁጥጥር በኬንያ ኖሮማል",
      price: 900,
      categoryName: "ኬንያ",
      description: "900+400 እያለ ይጨምራል",
    },
    {
      name: "ቁጥጥር በኬንያ ዊግ በቀሚስ",
      price: 1000,
      categoryName: "ኬንያ",
      description: "1000+500 እያለ ይጨምራል",
    },
    {
      name: "ትዊስት በኬንያ ዊግ በጣም በቀሚሱ",
      price: 1200,
      categoryName: "ኬንያ",
      description: "1200+700 እያለ ይጨምራል",
    },
    {
      name: "ትዊስት በኬንያ ዊግ",
      price: 1000,
      categoryName: "ኬንያ",
      description: "1000+600 እያለ ይጨምራል",
    },

    { name: "ፍሬንች ከርል የኤጅ", price: 1500, categoryName: "ፍሬንች ከርል" },
    { name: "ፍሬንች ከርል ዊግ", price: 3000, categoryName: "ፍሬንች ከርል" },
    { name: "ፍሬንች ከርል አንድ ጭማሪ ዊግ", price: 750, categoryName: "ፍሬንች ከርል" },
    { name: "ፍሬንች ከርል ሁለት ጭማሪ ዊግ", price: 1500, categoryName: "ፍሬንች ከርል" },

    { name: "ቅንድብ በምላጭ", price: 200, categoryName: "ቅንድብ" },
    { name: "ቅንድብ በክር", price: 300, categoryName: "ቅንድብ" },
    { name: "ኮንቱር በክር", price: 300, categoryName: "ቅንድብ" },
    { name: "ሙሉ ፊት በክር", price: 900, categoryName: "ቅንድብ" },
    { name: "ሃይ", price: 400, categoryName: "ቅንድብ" },
    { name: "ቅንድብ ማስተካከል እና ሃይ", price: 700, categoryName: "ቅንድብ" },

    { name: "የልጆች ሽሩባ በዲዛይን", price: 650, categoryName: "የልጆች ሽሩባ" },
    { name: "ጨሌ ሽሩባ በዲዛይን", price: 500, categoryName: "የልጆች ሽሩባ" },
    { name: "የልጆች ሽሩባ በአንድ ዊግ", price: 900, categoryName: "የልጆች ሽሩባ" },
    { name: "የልጆች ሽሩባ በሁለት ዊግ", price: 1200, categoryName: "የልጆች ሽሩባ" },

    {
      name: "ፖሽ ትዊስት እና ኪንኪ ከርል የኤጅ",
      price: 2000,
      categoryName: "ፖሽ ትዊስት እና ኪንኪ ከርል",
    },
    {
      name: "ፖሽ ትዊስት እና ኪንኪ ከርል በዊግ",
      price: 3500,
      categoryName: "ፖሽ ትዊስት እና ኪንኪ ከርል",
    },
    {
      name: "ፖሽ ትዊስት እና ኪንኪ ከርል ስፌት",
      price: 800,
      categoryName: "ፖሽ ትዊስት እና ኪንኪ ከርል",
    },
    {
      name: "ግማሽ ስፌት ግማሽ ሽሩባ",
      price: 1200,
      categoryName: "ፖሽ ትዊስት እና ኪንኪ ከርል",
    },

    { name: "አላባባ", price: 2000, categoryName: "ሀበሻ" },
    { name: "ጋሜ", price: 2000, categoryName: "ሀበሻ" },
    { name: "ዱላ በፍራ", price: 50, categoryName: "ሀበሻ" },
    { name: "ልዋም", price: 3500, categoryName: "ሀበሻ" },
    { name: "ጎንደር", price: 3000, categoryName: "ሀበሻ" },

    { name: "ሜዲ cure", price: 600, categoryName: "ኔይል/ጥፍር/" },
    { name: "ኖሮማል ሜዲ cure", price: 1200, categoryName: "ኔይል/ጥፍር/" },
    { name: "ስፔሻል ፔዲኪዩር", price: 2000, categoryName: "ኔይል/ጥፍር/" },
    { name: "ልጥፍ", price: 600, categoryName: "ኔይል/ጥፍር/" },
    { name: "ጄልስ", price: 700, categoryName: "ኔይል/ጥፍር/" },
    { name: "ጄል ሙሉት", price: 1500, categoryName: "ኔይል/ጥፍር/" },
    { name: "ፊልል", price: 1000, categoryName: "ኔይል/ጥፍር/" },
    { name: "ጄል ማሰለቀቅ", price: 200, categoryName: "ኔይል/ጥፍር/" },
    { name: "ጄልስ ማሰለቀቅ", price: 100, categoryName: "ኔይል/ጥፍር/" },
    { name: "አክሪሊክ እና ፖሊጄል ማሰለቀቅ", price: 300, categoryName: "ኔይል/ጥፍር/" },
    { name: "ኖሮማል ጥፍር ቀለም", price: 200, categoryName: "ኔይል/ጥፍር/" },

    { name: "እጥበት", price: 300, categoryName: "እጥበት" },
    { name: "ትሪትመንት እጥበት", price: 350, categoryName: "እጥበት" },
    { name: "ብሎ ድራይ (ፎም)", price: 200, categoryName: "እጥበት" },
    { name: "ካስክ", price: 500, categoryName: "እጥበት" },
    { name: "ሂዩማን ካስክ", price: 600, categoryName: "እጥበት" },

    { name: "ጥቁር ከራሳቸው ራሶች (ፍሮንታል)", price: 700, categoryName: "ቀለም" },
    { name: "ጥቁር ከራሳቸው ሙሉ", price: 1500, categoryName: "ቀለም" },
    { name: "ጥቁር ከቤቱ ራሶች", price: 2000, categoryName: "ቀለም" },
    { name: "ጥቁር ከቤቱ ሙሉ", price: 3000, categoryName: "ቀለም" },
    { name: "ቡኒ ከራሳቸው ራሶች", price: 700, categoryName: "ቀለም" },
    { name: "ቡኒ ከራሳቸው ሙሉ", price: 1500, categoryName: "ቀለም" },
    { name: "ቡኒ ከቤቱ ራሶች", price: 4000, categoryName: "ቀለም" },
    { name: "ቡኒ ከቤቱ ሙሉ", price: 7000, categoryName: "ቀለም" },

    { name: "አይላሽ ቆንጣይ ዊግ", price: 4000, categoryName: "አይላሽ" },
    { name: "አይላሽ ሰራ ቆንጣይ ዊግ", price: 2700, categoryName: "አይላሽ" },
    { name: "አይላሽ ፕራሚየም 4D", price: 4000, categoryName: "አይላሽ" },
    { name: "ክላስተር ላሽ", price: 1500, categoryName: "አይላሽ" },

    { name: "ፍሪዝ በኮንደሽነር", price: 400, categoryName: "ፍሪዝ" },
    { name: "ፍሪዝ በኮንቱ", price: 850, categoryName: "ፍሪዝ" },
    { name: "ፍሪዝ በኮንዲሽነር", price: 1000, categoryName: "ፍሪዝ" },
    { name: "ፍሪዝ በኮንዲሽነር ሂዩማን", price: 1200, categoryName: "ፍሪዝ" },

    { name: "ጥቁር ከቤቱ", price: 4000, categoryName: "ሂዩማን እና ረጅም ፀጉር" },
    { name: "ቡኒ ከቤቱ", price: 7000, categoryName: "ሂዩማን እና ረጅም ፀጉር" },
    { name: "ሃይ ላይት ከቤቱ", price: 6000, categoryName: "ሂዩማን እና ረጅም ፀጉር" },

    { name: "ቡህ በኬንያ አንድ ዊግ", price: 2000, categoryName: "ቡህ" },
    { name: "ቡህ በኬንያ ሁለት ዊግ", price: 3500, categoryName: "ቡህ" },
    { name: "ቡህ በሁለት ፀጉር", price: 3500, categoryName: "ቡህ" },

    { name: "ሃይ ላይት ከራሳቸው ሙሉ", price: 2000, categoryName: "ሃይ ላይት" },
    { name: "ሃይ ላይት ከቤቱ ሙሉ", price: 6000, categoryName: "ሃይ ላይት" },

    { name: "ሪላክሰር ፊትፎ ከራሳቸው", price: 800, categoryName: "ሪላክሰር" },
    { name: "ሙሉ ሪላክሰር ከራሳቸው", price: 1500, categoryName: "ሪላክሰር" },
    { name: "ሪላክሰር ፊትፎ ከቤቱ", price: 2000, categoryName: "ሪላክሰር" },
    { name: "ሪላክሰር ሙሉ ከቤቱ", price: 3000, categoryName: "ሪላክሰር" },

    { name: "ብብት ዋክስ", price: 600, categoryName: "ዋክስ" },
    { name: "ግማሽ እግር ዋክስ", price: 1000, categoryName: "ዋክስ" },
    { name: "ሙሉ እግር ዋክስ", price: 2300, categoryName: "ዋክስ" },
    { name: "ግማሽ እጅ ዋክስ", price: 800, categoryName: "ዋክስ" },
    { name: "ሙሉ እጅ ዋክስ", price: 1200, categoryName: "ዋክስ" },

    { name: "አንድ ክሊፕ ዊግ", price: 200, categoryName: "ክሊፕ" },
    { name: "ሁለት ክሊፕ ዊግ", price: 400, categoryName: "ክሊፕ" },
    { name: "ሶስት ክሊፕ ዊግ", price: 500, categoryName: "ክሊፕ" },
  ];

  // Insert services
  for (const service of serviceData) {
    const category = insertedCategories.find(
      (cat) => cat.name === service.categoryName,
    );
    if (!category) {
      console.error(`Category not found: ${service.categoryName}`);
      continue;
    }

    // Check if service already exists
    const existing = await db
      .select()
      .from(services)
      .where(eq(services.name, service.name))
      .limit(1);

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
        basePrice: toSantim(service.price),
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
