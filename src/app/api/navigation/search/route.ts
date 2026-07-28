import { NextRequest, NextResponse } from "next/server";
import { searchTomTom } from "../../../../services/tomtom.service";
import { searchOsm } from "../../../../services/osmGeocode.service";

export const dynamic = "force-dynamic";

/**
 * Place search: TomTom plus OpenStreetMap.
 *
 * TomTom alone returned only cities in Pakistan — its index there has no
 * street-level data ("Mall Road Lahore", "Liberty Market Lahore" and
 * "Ferozepur Road Lahore" all return nothing, and reverse-geocoding Lahore
 * yields "Islamabad, Punjab"). OSM has all of them, so the two are queried
 * together and merged.
 *
 * Both run concurrently; whichever fails contributes nothing rather than
 * failing the request.
 */

/** ISO alpha-2 for the bias point, so border-adjacent results don't dominate. */
const countryForBias = async (lat?: number, lon?: number): Promise<string | undefined> => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  try {
    // Cheapest reliable signal available: TomTom's own reverse geocode gives a
    // correct countryCode for Pakistan even though its municipality field is
    // wrong, and country is all we need here.
    const key = process.env.TOMTOM_API_KEY;
    if (!key) return undefined;
    const response = await fetch(
      `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?key=${key}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    const code = data?.addresses?.[0]?.address?.countryCode;
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ success: false, message: "Query parameter 'q' is required" }, { status: 400 });
  }

  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");

  const lat = latParam ? Number(latParam) : undefined;
  const lon = lonParam ? Number(lonParam) : undefined;

  try {
    const country = await countryForBias(lat, lon);

    const [tomTomResults, osmResults] = await Promise.all([
      searchTomTom(query, lat, lon).catch(() => []),
      searchOsm(query, country).catch(() => []),
    ]);

    const fromTomTom = tomTomResults.map((item) => ({ ...item, source: "tomtom" }));

    const fromOsm = osmResults.map((item) => ({
      id: item.id,
      name: item.name,
      address: item.address,
      city: item.city,
      country: item.country,
      category: item.category,
      position: item.position,
      source: "osm",
    }));

    // Drop OSM entries that duplicate a TomTom hit at roughly the same spot.
    // 3 decimal places is ~110 m, close enough to call it the same place.
    const seen = new Set(
      fromTomTom.map(
        (item) => `${item.name?.toLowerCase()}|${item.position.latitude.toFixed(3)}|${item.position.longitude.toFixed(3)}`,
      ),
    );

    const merged = [
      ...fromTomTom,
      ...fromOsm.filter((item) => {
        const key = `${item.name.toLowerCase()}|${item.position.latitude.toFixed(3)}|${item.position.longitude.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];

    /**
     * Rank by name relevance first, then by distance from the bias point.
     *
     * Source order alone was wrong: TomTom results were listed first, so a
     * search for "Mall Road" biased to Lahore led with Amritsar and Firozpur.
     * Those are ~50 km across the border, and TomTom's coverage there is far
     * denser than its Pakistan coverage, so they crowded out the real answer.
     *
     * Distance is the tiebreaker rather than the primary key, so deliberately
     * searching a distant city by name still works — an exact name match beats
     * anything nearby.
     */
    const needle = query.trim().toLowerCase();

    const relevance = (name: string | undefined) => {
      const value = (name || "").trim().toLowerCase();
      // Providers return qualified names like "Karachi, Sind", so compare the
      // leading segment too. Without this, "Karachi, Sind" scored the same as
      // "Karachi Engineers" and the nearer of the two won on distance — which
      // put a business in Amritsar above the city the user asked for.
      const head = value.split(",")[0].trim();

      if (value === needle || head === needle) return 4;
      if (head.startsWith(`${needle} `)) return 3;
      if (value.startsWith(needle)) return 2;
      if (value.includes(needle)) return 1;
      return 0;
    };

    const distanceFromBias = (item: { position: { latitude: number; longitude: number } }) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 0;
      // Equirectangular approximation — plenty for ordering, and far cheaper
      // than haversine on every result.
      const dLat = item.position.latitude - (lat as number);
      const dLon = (item.position.longitude - (lon as number)) * Math.cos(((lat as number) * Math.PI) / 180);
      return dLat * dLat + dLon * dLon;
    };

    const ranked = merged
      .map((item, index) => ({ item, index, rel: relevance(item.name), dist: distanceFromBias(item) }))
      .sort((a, b) => b.rel - a.rel || a.dist - b.dist || a.index - b.index)
      .map((entry) => entry.item);

    /**
     * Collapse same-name-same-city entries, keeping the first.
     *
     * OSM models a long road as several ways, so "Mall Road" comes back once
     * per segment — three identical-looking "Liberty Market, Lahore Cant" rows
     * in the suggestion list. Running after the sort means the survivor is the
     * closest one to the user rather than an arbitrary segment.
     */
    const byNameAndCity = new Set<string>();
    const final = ranked.filter((item) => {
      const key = `${(item.name || "").toLowerCase()}|${(item.city || "").toLowerCase()}`;
      if (byNameAndCity.has(key)) return false;
      byNameAndCity.add(key);
      return true;
    });

    return NextResponse.json({ success: true, data: final });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
