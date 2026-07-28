import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveDestination, buildPlaceProfile } from "../../../../services/tripPlaces";
import { writeNarrative } from "../../../../services/tripNarrative";

// Live place lookup runs per request, so this route can never be prerendered.
export const dynamic = "force-dynamic";

const destinationProfiles: Record<
  string,
  {
    attractions: string[];
    foods: string[];
    nature: string[];
    shopping: string[];
    hotel: string;
    safety: string[];
    packing: string[];
  }
> = {
  hunza: {
    attractions: [
      "Baltit Fort",
      "Altit Fort",
      "Karimabad Bazaar",
      "Eagle's Nest viewpoint",
      "Ganish historic settlement",
      "Passu Cones",
      "Attabad Lake",
      "Hussaini Suspension Bridge",
      "Khunjerab Pass",
    ],
    foods: [
      "Chapshuro",
      "Hunza walnut cake",
      "Local apricot juice",
      "Mamtu dumplings",
      "Traditional daudo soup",
    ],
    nature: [
      "Sunrise over Rakaposhi",
      "Attabad Lake boating",
      "Passu glacier viewpoint",
      "Duikar sunset",
      "Borith Lake walk",
    ],
    shopping: [
      "Karimabad handicrafts",
      "Dry fruit market",
      "Gemstone and local wool shops",
    ],
    hotel: "A well-rated guesthouse in Karimabad with mountain views",
    safety: [
      "Carry warm layers because mountain weather changes quickly.",
      "Confirm road conditions before travelling toward Khunjerab.",
      "Keep cash because card service may be limited in remote areas.",
    ],
    packing: [
      "Warm jacket",
      "Comfortable walking shoes",
      "Sunblock",
      "Reusable water bottle",
      "Power bank",
      "Basic medicines",
    ],
  },

  lahore: {
    attractions: [
      "Badshahi Mosque",
      "Lahore Fort",
      "Minar-e-Pakistan",
      "Walled City",
      "Shalimar Gardens",
      "Lahore Museum",
      "Wagah Border",
      "Food Street",
    ],
    foods: [
      "Lahori chargha",
      "Nihari",
      "Payee",
      "Gol gappay",
      "Traditional lassi",
    ],
    nature: [
      "Morning walk at Greater Iqbal Park",
      "Jilani Park visit",
      "Canal-side drive",
    ],
    shopping: [
      "Anarkali Bazaar",
      "Liberty Market",
      "Packages Mall",
      "Fortress Square",
    ],
    hotel: "A central hotel near Gulberg or Mall Road",
    safety: [
      "Use verified transport during late hours.",
      "Keep drinking water during hot weather.",
      "Allow extra travel time during peak traffic.",
    ],
    packing: [
      "Light clothing",
      "Comfortable shoes",
      "Sunblock",
      "Water bottle",
      "Power bank",
      "Modest clothing for religious sites",
    ],
  },

  karachi: {
    attractions: [
      "Mazar-e-Quaid",
      "Mohatta Palace",
      "Pakistan Maritime Museum",
      "Frere Hall",
      "Port Grand",
      "Clifton Sea View",
      "TDF Ghar",
      "Churna Island",
    ],
    foods: [
      "Karachi biryani",
      "Nihari",
      "Bun kebab",
      "Seafood",
      "Rabri and falooda",
    ],
    nature: [
      "Sunset at Sea View",
      "Hawksbay beach visit",
      "Manora waterfront",
      "Safari Park morning walk",
    ],
    shopping: [
      "Dolmen Mall Clifton",
      "Tariq Road",
      "Zainab Market",
      "LuckyOne Mall",
    ],
    hotel: "A secure hotel in Clifton, DHA or Shahrah-e-Faisal",
    safety: [
      "Use trusted ride services and avoid isolated routes at night.",
      "Check weather and sea conditions before beach activities.",
      "Keep valuables secure in crowded markets.",
    ],
    packing: [
      "Light breathable clothes",
      "Sunblock",
      "Water bottle",
      "Power bank",
      "Cap or sunglasses",
      "Basic medicines",
    ],
  },

  makkah: {
    attractions: [
      "Masjid al-Haram",
      "Jabal al-Nour",
      "Cave of Hira area",
      "Jabal Thawr",
      "Mina",
      "Arafat",
      "Muzdalifah",
      "Makkah Museum",
    ],
    foods: [
      "Kabsa",
      "Mandi",
      "Dates and Arabic coffee",
      "Mutabbaq",
      "Fresh juices",
    ],
    nature: [
      "Early morning mountain view",
      "Quiet evening walk near the Haram area",
    ],
    shopping: [
      "Abraj Al Bait Mall",
      "Local dates and prayer-item shops",
      "Souq Al Hijaz",
    ],
    hotel: "A hotel within convenient shuttle or walking distance of Masjid al-Haram",
    safety: [
      "Keep identification and hotel details with you.",
      "Stay hydrated and avoid peak heat hours.",
      "Follow official crowd-management instructions.",
    ],
    packing: [
      "Comfortable sandals",
      "Prayer essentials",
      "Reusable water bottle",
      "Light modest clothing",
      "Personal medicines",
      "Small waist bag",
    ],
  },

  dubai: {
    attractions: [
      "Burj Khalifa",
      "Dubai Mall",
      "Museum of the Future",
      "Dubai Marina",
      "Palm Jumeirah",
      "Old Dubai and Al Fahidi",
      "Desert safari",
      "Global Village",
    ],
    foods: [
      "Emirati machboos",
      "Shawarma",
      "Arabic mixed grill",
      "Luqaimat",
      "International food court experience",
    ],
    nature: [
      "Jumeirah Beach morning",
      "Dubai Creek sunset",
      "Desert safari",
      "Miracle Garden",
    ],
    shopping: [
      "Dubai Mall",
      "Mall of the Emirates",
      "Gold Souk",
      "Dubai Outlet Mall",
    ],
    hotel: "A metro-accessible hotel in Deira, Downtown or Dubai Marina",
    safety: [
      "Respect local laws and public conduct rules.",
      "Carry water during outdoor activities.",
      "Use official taxis, metro or verified ride services.",
    ],
    packing: [
      "Light clothing",
      "Modest outfit",
      "Sunblock",
      "Comfortable shoes",
      "Travel adapter",
      "Power bank",
    ],
  },
};

const genericProfile = (destination: string) => ({
  attractions: [
    `${destination} city center`,
    `${destination} heritage district`,
    `${destination} main landmark`,
    `${destination} local museum`,
    `${destination} popular viewpoint`,
    `${destination} cultural area`,
    `${destination} nearby attraction`,
  ],
  foods: [
    "Local breakfast",
    "Traditional lunch",
    "Popular street food",
    "Regional dinner",
    "Local dessert",
  ],
  nature: [
    "Morning scenic walk",
    "Local park visit",
    "Sunset viewpoint",
    "Nearby nature excursion",
  ],
  shopping: [
    "Traditional market",
    "Local handicraft shops",
    "Popular shopping district",
  ],
  hotel: `A centrally located, well-reviewed hotel in ${destination}`,
  safety: [
    "Use verified transport and keep emergency contacts available.",
    "Keep identification and hotel details with you.",
    "Check local weather and road conditions before departure.",
  ],
  packing: [
    "Comfortable shoes",
    "Weather-appropriate clothes",
    "Reusable water bottle",
    "Power bank",
    "Travel documents",
    "Basic medicines",
  ],
});

const rotate = <T,>(items: T[], offset: number) =>
  items[offset % items.length];

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const parsedBody = bodyText ? JSON.parse(bodyText) : {};
    const body = z
      .object({
        destination: z.string().trim().min(2),
        days: z.number().int().min(1).max(14),
        budget: z.number().positive(),
        currency: z.string().trim().min(3).max(4).default("PKR"),
        tripType: z.string().trim().default("Family"),
        transport: z.string().trim().default("Car"),
      })
      .parse(parsedBody);

    const normalized = body.destination.toLowerCase();

    const profileKey = Object.keys(destinationProfiles).find((key) =>
      normalized.includes(key),
    );

    /**
     * Three tiers, best first:
     *   1. A curated profile — real local knowledge (Baltit Fort, chapshuro)
     *      that no POI API returns. Only five destinations have one.
     *   2. Real places looked up from `tourism_pois` and TomTom. This is what
     *      the other ~everywhere now gets instead of "<city> main landmark".
     *   3. The generic profile, only when a lookup genuinely returns nothing
     *      (offline, provider down, or a destination with no POI coverage).
     */
    let profile = profileKey ? destinationProfiles[profileKey] : null;
    let placeSource: string = profileKey ? "curated" : "generic";

    if (!profile) {
      const coords = await resolveDestination(body.destination);
      const places = await buildPlaceProfile(body.destination, coords);

      if (places.source !== "none" && places.attractions.length > 0) {
        const generic = genericProfile(body.destination);
        profile = {
          attractions: places.attractions,
          // Keep a category non-empty by falling back per-field rather than
          // wholesale — a city with real attractions but no listed parks
          // should still use its real attractions.
          foods: places.foods.length > 0 ? places.foods : generic.foods,
          nature: places.nature.length > 0 ? places.nature : generic.nature,
          shopping: places.shopping.length > 0 ? places.shopping : generic.shopping,
          hotel: places.hotel || generic.hotel,
          safety: generic.safety,
          packing: generic.packing,
        };
        placeSource = places.source;
      } else {
        profile = genericProfile(body.destination);
      }
    }

    /**
     * A destination with thin POI coverage (Skardu returns a single result)
     * would otherwise have `rotate()` hand back the same place twice, printing
     * day titles like "Shangrila Resort and Shangrila Resort". Top the pool up
     * with generic entries so every day has two distinct things in it; the real
     * places stay first, so they are the ones that get used.
     */
    const needed = body.days * 2;
    if (profile.attractions.length < needed) {
      const filler = genericProfile(body.destination).attractions.filter(
        (item) => !profile!.attractions.includes(item),
      );
      profile = {
        ...profile,
        attractions: [...profile.attractions, ...filler].slice(0, Math.max(needed, profile.attractions.length)),
      };
    }

    const dailyBudget = Math.max(1, Math.floor(body.budget / body.days));

    const itinerary = Array.from(
      { length: body.days },
      (_, index) => {
        const day = index + 1;
        const attraction = rotate(profile.attractions, index);
        const secondAttraction = rotate(
          profile.attractions,
          index + body.days,
        );
        const food = rotate(profile.foods, index);
        const nature = rotate(profile.nature, index);
        const shopping = rotate(profile.shopping, index);

        const isFirst = day === 1;
        const isLast = day === body.days;

        const activities = isFirst
          ? [
              {
                time: "09:00",
                title: `Arrival in ${body.destination}`,
                description: `Check in, refresh and review your ${body.transport.toLowerCase()} arrangements.`,
                category: "arrival",
                estimatedCost: Math.round(dailyBudget * 0.12),
              },
              {
                time: "11:30",
                title: attraction,
                description: `Begin your journey with a guided visit to ${attraction}.`,
                category: "sightseeing",
                estimatedCost: Math.round(dailyBudget * 0.18),
              },
              {
                time: "14:00",
                title: `Try ${food}`,
                description: `Enjoy a recommended local meal and learn about the destination's food culture.`,
                category: "food",
                estimatedCost: Math.round(dailyBudget * 0.18),
              },
              {
                time: "17:00",
                title: nature,
                description: `Relax with a scenic experience at ${nature}.`,
                category: "nature",
                estimatedCost: Math.round(dailyBudget * 0.12),
              },
              {
                time: "20:00",
                title: "Hotel check-in and rest",
                description: profile.hotel,
                category: "rest",
                estimatedCost: Math.round(dailyBudget * 0.4),
              },
            ]
          : isLast
            ? [
                {
                  time: "08:30",
                  title: "Final local breakfast",
                  description: `Enjoy ${food} before the final exploration.`,
                  category: "food",
                  estimatedCost: Math.round(dailyBudget * 0.12),
                },
                {
                  time: "10:00",
                  title: secondAttraction,
                  description: `Complete the trip with a visit to ${secondAttraction}.`,
                  category: "sightseeing",
                  estimatedCost: Math.round(dailyBudget * 0.2),
                },
                {
                  time: "13:00",
                  title: shopping,
                  description: `Buy local gifts and souvenirs from ${shopping}.`,
                  category: "shopping",
                  estimatedCost: Math.round(dailyBudget * 0.22),
                },
                {
                  time: "16:00",
                  title: "Check-out and departure",
                  description: `Leave for your return journey using ${body.transport.toLowerCase()}.`,
                  category: "departure",
                  estimatedCost: Math.round(dailyBudget * 0.46),
                },
              ]
            : [
                {
                  time: "08:00",
                  title: `Breakfast and day briefing`,
                  description: `Start day ${day} with breakfast and confirm route/weather conditions.`,
                  category: "food",
                  estimatedCost: Math.round(dailyBudget * 0.1),
                },
                {
                  time: "09:30",
                  title: attraction,
                  description: `Explore ${attraction} and its cultural importance.`,
                  category: "sightseeing",
                  estimatedCost: Math.round(dailyBudget * 0.2),
                },
                {
                  time: "13:00",
                  title: `Lunch: ${food}`,
                  description: `Try ${food} at a well-reviewed local restaurant.`,
                  category: "food",
                  estimatedCost: Math.round(dailyBudget * 0.17),
                },
                {
                  time: "15:00",
                  title: secondAttraction,
                  description: `Continue to ${secondAttraction} for a different experience.`,
                  category: "sightseeing",
                  estimatedCost: Math.round(dailyBudget * 0.18),
                },
                {
                  time: "17:30",
                  title: index % 2 === 0 ? nature : shopping,
                  description:
                    index % 2 === 0
                      ? `Enjoy the evening at ${nature}.`
                      : `Explore ${shopping} and support local businesses.`,
                  category: index % 2 === 0 ? "nature" : "shopping",
                  estimatedCost: Math.round(dailyBudget * 0.15),
                },
                {
                  time: "20:00",
                  title: "Dinner and rest",
                  description: `Review photos, update the next day's plan and rest at the hotel.`,
                  category: "rest",
                  estimatedCost: Math.round(dailyBudget * 0.2),
                },
              ];

        const estimatedDailyCost = activities.reduce(
          (sum, activity) => sum + activity.estimatedCost,
          0,
        );

        return {
          day,
          title: isFirst
            ? `Arrival and first look at ${body.destination}`
            : isLast
              ? "Final exploration and departure"
              : `${attraction} and ${secondAttraction}`,
          summary: isFirst
            ? "Settle in, experience the first landmark and enjoy a relaxed evening."
            : isLast
              ? "Complete the remaining highlights, shop for souvenirs and begin the return journey."
              : `A balanced day of sightseeing, local food and ${
                  index % 2 === 0 ? "nature" : "shopping"
                }.`,
          activities,
          estimatedDailyCost,
        };
      },
    );

    const estimatedTotalCost = itinerary.reduce(
      (sum, day) => sum + day.estimatedDailyCost,
      0,
    );

    /**
     * Model-written prose over the factual plan. Applied only to titles and
     * summaries — stops, times and costs are never handed to the model to
     * change, so a hallucination cannot reach the itinerary itself.
     */
    let narrated = itinerary;
    let narrativeSource: "model" | "generated" = "generated";

    const narrative = await writeNarrative({
      destination: body.destination,
      tripType: body.tripType,
      transport: body.transport,
      currency: body.currency,
      itinerary,
    });

    if (narrative.ok) {
      const byDay = new Map(narrative.days.map((d) => [d.day, d]));
      narrated = itinerary.map((day) => {
        const written = byDay.get(day.day);
        return written ? { ...day, title: written.title, summary: written.summary } : day;
      });
      narrativeSource = "model";
    }

    return NextResponse.json({
      success: true,
      data: {
        id: crypto.randomUUID(),
        destination: body.destination,
        days: body.days,
        budget: body.budget,
        currency: body.currency,
        tripType: body.tripType,
        transport: body.transport,
        hotelSuggestion: profile.hotel,
        foodSuggestion: profile.foods.join(", "),
        packingList: profile.packing,
        safetyTips: profile.safety,
        itinerary: narrated,
        estimatedTotalCost,
        createdAt: new Date().toISOString(),
        // Lets the UI say where the places came from instead of implying every
        // plan is equally well-sourced.
        placeSource,
        narrativeSource,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
