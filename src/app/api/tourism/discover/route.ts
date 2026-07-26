import { NextRequest, NextResponse } from "next/server";
import { searchTomTom } from "../../../../services/tomtom.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");

    if (!city) {
      return NextResponse.json({ success: false, message: "City parameter is required" }, { status: 400 });
    }

    try {
      // Fetch real data from TomTom for ALL cities
      const [food, shopping, parks, historical] = await Promise.all([
        searchTomTom(`restaurants in ${city}`).catch(() => []),
        searchTomTom(`shopping malls in ${city}`).catch(() => []),
        searchTomTom(`tourist attractions in ${city}`).catch(() => []),
        searchTomTom(`historical monuments in ${city}`).catch(() => []),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          city: city.charAt(0).toUpperCase() + city.slice(1),
          country: food[0]?.country || shopping[0]?.country || "Unknown",
          famousPlaces: parks.slice(0, 5).map(p => p.name),
          localFood: food.slice(0, 5).map(f => f.name),
          shoppingStreets: shopping.slice(0, 5).map(s => s.name),
          weekendActivities: parks.slice(0, 5).map(p => p.name),
          historicalSites: historical.slice(0, 5).map(h => h.name),
          discoveryScore: 75, // Good score for live discovered data
        },
      });
    } catch (err) {
      // Ultimate fallback if TomTom fails entirely
      return NextResponse.json({
        success: true,
        data: {
          city,
          country: "Unknown",
          famousPlaces: ["Local attractions"],
          localFood: ["Local restaurants"],
          shoppingStreets: ["Local markets"],
          weekendActivities: ["Explore the city center", "Visit local attractions"],
          historicalSites: ["Local historical landmarks"],
          discoveryScore: 50,
        },
      });
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
