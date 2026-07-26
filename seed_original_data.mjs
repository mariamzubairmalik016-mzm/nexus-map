import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

const SEED_POIS = [
  { id: "poi-1", name: "Serena Hotel Hunza", category: "hotel", description: "Luxury hotel with breathtaking views of the Hunza Valley.", shortDescription: "Premium valley-view accommodation", latitude: 36.3167, longitude: 74.65, address: "Karimabad, Hunza", city: "Hunza Valley", country: "Pakistan", countryIso2: "PK", imageUrl: "/destinations/hunza.jpg", rating: 4.8, reviewCount: 234, priceLevel: 3, phone: "+92-5811-451111", isVerified: 1, isFeatured: 1, tags: ["luxury","mountain_view","family_friendly"] },
  { id: "poi-2", name: "Badshahi Mosque", category: "historical", description: "One of the largest mosques in the world, built in 1673.", shortDescription: "Iconic Mughal-era mosque", latitude: 31.5881, longitude: 74.3106, address: "Walled City, Lahore", city: "Lahore", country: "Pakistan", countryIso2: "PK", imageUrl: "/destinations/lahore.jpg", rating: 4.9, reviewCount: 567, isVerified: 1, isFeatured: 1, tags: ["historical","architecture","must_visit"] },
  { id: "poi-3", name: "Faisal Mosque", category: "mosque", description: "The largest mosque in Pakistan, at the foot of Margalla Hills.", shortDescription: "National mosque of Pakistan", latitude: 33.7294, longitude: 73.0381, address: "Islamabad", city: "Islamabad", country: "Pakistan", countryIso2: "PK", imageUrl: "/destinations/islamabad.jpg", rating: 4.7, reviewCount: 891, isVerified: 1, isFeatured: 1, tags: ["religious","architecture","iconic"] },
  { id: "poi-4", name: "Shangrila Resort Skardu", category: "resort", description: "Famous resort by Lower Kachura Lake.", shortDescription: "Heavenly lake-view resort", latitude: 35.2971, longitude: 75.6333, address: "Skardu", city: "Skardu", country: "Pakistan", countryIso2: "PK", imageUrl: "/destinations/skardu.jpg", rating: 4.6, reviewCount: 312, priceLevel: 3, isVerified: 1, isFeatured: 1, tags: ["lake_view","romantic","nature"] },
  { id: "poi-5", name: "Mohatta Palace Museum", category: "museum", description: "A historic museum showcasing art and cultural heritage.", shortDescription: "Heritage museum in a palace", latitude: 24.8103, longitude: 67.0324, address: "Clifton, Karachi", city: "Karachi", country: "Pakistan", countryIso2: "PK", rating: 4.5, reviewCount: 445, isVerified: 1, isFeatured: 0, tags: ["art","history","architecture"] },
  { id: "poi-6", name: "Attabad Lake", category: "lake", description: "Stunning turquoise lake formed after a landslide.", shortDescription: "Turquoise gem of Hunza", latitude: 36.3352, longitude: 74.8102, address: "Gojal, Hunza", city: "Hunza Valley", country: "Pakistan", countryIso2: "PK", rating: 4.8, reviewCount: 678, isVerified: 1, isFeatured: 1, tags: ["boating","photography","nature"] },
  { id: "poi-7", name: "Fairy Meadows", category: "camping", description: "Enchanting alpine meadow at the base of Nanga Parbat.", shortDescription: "Camping beneath the killer mountain", latitude: 35.3583, longitude: 74.6064, address: "Diamer, Gilgit-Baltistan", city: "Gilgit", country: "Pakistan", countryIso2: "PK", rating: 4.9, reviewCount: 234, isVerified: 1, isFeatured: 1, tags: ["camping","trekking","mountain"] },
  { id: "poi-8", name: "Burj Khalifa", category: "famous_place", description: "World's tallest building with stunning observation decks.", shortDescription: "World's tallest building", latitude: 25.1972, longitude: 55.2744, address: "Downtown Dubai", city: "Dubai", country: "United Arab Emirates", countryIso2: "AE", rating: 4.8, reviewCount: 2345, priceLevel: 4, isVerified: 1, isFeatured: 1, tags: ["iconic","city_views","luxury"] },
  { id: "poi-9", name: "Eiffel Tower", category: "famous_place", description: "Iconic iron lattice tower on the Champ de Mars.", shortDescription: "Iconic Paris landmark", latitude: 48.8584, longitude: 2.2945, address: "Champ de Mars, Paris", city: "Paris", country: "France", countryIso2: "FR", rating: 4.7, reviewCount: 4567, priceLevel: 3, isVerified: 1, isFeatured: 1, tags: ["iconic","landmark","photography"] },
  { id: "poi-10", name: "Clifton Beach", category: "beach", description: "Karachi's famous beach stretch with camel rides.", shortDescription: "Karachi's seaside escape", latitude: 24.7945, longitude: 67.0254, address: "Clifton, Karachi", city: "Karachi", country: "Pakistan", countryIso2: "PK", rating: 4.1, reviewCount: 890, isVerified: 1, isFeatured: 0, tags: ["beach","family","sunset"] },
  { id: "poi-11", name: "Margalla Hills Trail 3", category: "hiking", description: "Popular hiking trail through Margalla Hills National Park.", shortDescription: "Scenic city hiking trail", latitude: 33.7384, longitude: 73.0773, address: "Margalla Hills, Islamabad", city: "Islamabad", country: "Pakistan", countryIso2: "PK", rating: 4.6, reviewCount: 345, isVerified: 1, isFeatured: 0, tags: ["hiking","nature","fitness"] },
  { id: "poi-12", name: "Pakistan Monument", category: "famous_place", description: "National monument symbolizing Pakistani unity.", shortDescription: "Symbol of national unity", latitude: 33.6930, longitude: 73.0691, address: "Shakarparian, Islamabad", city: "Islamabad", country: "Pakistan", countryIso2: "PK", rating: 4.5, reviewCount: 456, isVerified: 1, isFeatured: 1, tags: ["national","museum","gardens"] },
];

async function seedData() {
  console.log("Seeding original POIs into Vercel Postgres...");
  for (const poi of SEED_POIS) {
    try {
      await db.execute(`
        INSERT INTO tourism_pois (
          id, name, category, description, short_description, 
          latitude, longitude, address, city, country, 
          country_iso2, image_url, rating, review_count, 
          price_level, phone, website, opening_hours, 
          is_verified, is_featured, tags
        ) VALUES (
          '${poi.id}', 
          '${poi.name.replace(/'/g, "''")}', 
          '${poi.category.replace(/'/g, "''")}', 
          '${poi.description.replace(/'/g, "''")}', 
          ${poi.shortDescription ? `'${poi.shortDescription.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.latitude}, 
          ${poi.longitude}, 
          ${poi.address ? `'${poi.address.replace(/'/g, "''")}'` : "NULL"}, 
          '${poi.city.replace(/'/g, "''")}', 
          '${poi.country.replace(/'/g, "''")}', 
          ${poi.countryIso2 ? `'${poi.countryIso2.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.imageUrl ? `'${poi.imageUrl.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.rating || 0}, 
          ${poi.reviewCount || 0}, 
          ${poi.priceLevel || "NULL"}, 
          ${poi.phone ? `'${poi.phone.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.website ? `'${poi.website.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.openingHours ? `'${poi.openingHours.replace(/'/g, "''")}'` : "NULL"}, 
          ${poi.isVerified ? 1 : 0}, 
          ${poi.isFeatured ? 1 : 0}, 
          ${poi.tags ? `'${JSON.stringify(poi.tags).replace(/'/g, "''")}'` : "NULL"}
        )
        ON CONFLICT (id) DO UPDATE SET is_featured = ${poi.isFeatured ? 1 : 0};
      `);
    } catch (err) {
      console.warn(`Failed to insert POI ${poi.id}: ${err.message}`);
    }
  }

  console.log("Original POIs successfully restored to Vercel Postgres!");
  process.exit(0);
}

seedData().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
