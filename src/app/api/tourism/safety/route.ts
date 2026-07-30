import { NextRequest, NextResponse } from "next/server";

const EMERGENCY_NUMBERS = [
  { name: "Police", number: "15", icon: "Shield" },
  { name: "Ambulance", number: "115", icon: "Ambulance" },
  { name: "Fire Brigade", number: "16", icon: "Flame" },
  { name: "Rescue 1122", number: "1122", icon: "LifeBuoy" },
  { name: "Tourist Police", number: "118", icon: "MapPin" },
];

import { searchNearbyPoiTomTom } from "../../../../services/tomtom.service";

const SAFETY_TIPS = [
  "Share your live location with family members",
  "Set up safe zones for children",
  "Enable SOS quick access on your phone",
  "Keep your phone charged when traveling",
  "Avoid isolated areas at night",
  "Keep copies of important documents",
  "Register with your embassy when traveling abroad",
  "Use official taxis and ride-sharing services",
  "Keep emergency cash in a separate place",
  "Trust your instincts — if it feels unsafe, leave",
];

const HEALTH_TIPS = [
  "Drink plenty of water in hot climates",
  "Carry a basic first-aid kit",
  "Know the location of the nearest hospital",
  "Keep emergency numbers saved in your phone",
  "Get travel insurance before international trips",
  "Check vaccination requirements for your destination",
  "Carry necessary medications with prescriptions",
  "Use mosquito repellent in tropical areas",
  "Wear sunscreen even on cloudy days",
  "Wash hands frequently and carry hand sanitizer",
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "emergency";
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    switch (type) {
      case "emergency":
        return NextResponse.json({
          success: true,
          data: {
            numbers: EMERGENCY_NUMBERS,
            safetyTips: SAFETY_TIPS,
            healthTips: HEALTH_TIPS,
          },
        });

      case "health-facilities": {
        const facilityType = searchParams.get("facility_type") || "all";
        
        if (!lat || !lng) {
          return NextResponse.json({ success: true, data: [] });
        }

        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);

        /**
         * Search terms, not `categorySet`. TomTom returns zero results for
         * every categorySet query on this account, so the previous
         * implementation could only ever produce an empty list — the Safety
         * Centre's "no facilities nearby" was the API being asked wrongly,
         * not the area being empty. The term also carries the type, which is
         * what the old code tried (and mostly failed) to infer from a
         * free-text category string.
         */
        const TERMS: Record<string, Array<{ term: string; type: string; emergency: boolean }>> = {
          hospital: [{ term: "hospital", type: "hospital", emergency: true }],
          clinic: [{ term: "clinic", type: "clinic", emergency: false }],
          pharmacy: [{ term: "pharmacy", type: "pharmacy", emergency: false }],
          blood_bank: [{ term: "blood bank", type: "blood_bank", emergency: true }],
          emergency: [{ term: "emergency hospital", type: "hospital", emergency: true }],
          all: [
            { term: "hospital", type: "hospital", emergency: true },
            { term: "clinic", type: "clinic", emergency: false },
            { term: "pharmacy", type: "pharmacy", emergency: false },
          ],
        };

        const searches = TERMS[facilityType] ?? TERMS.all;

        try {
          const settled = await Promise.all(
            searches.map(async (search) => {
              try {
                const results = await searchNearbyPoiTomTom(search.term, userLat, userLng, 25000, 15);
                return results.map((f) => ({
                  id: f.id,
                  name: f.name,
                  type: search.type,
                  latitude: f.position.latitude,
                  longitude: f.position.longitude,
                  address: f.address,
                  phone: f.phone || "",
                  emergency: search.emergency,
                  // Not published by the search API — claiming "open 24 hours"
                  // for every result would be a dangerous guess in a safety
                  // feature, so only genuine emergency facilities get it.
                  open24Hours: search.emergency,
                  distance: Math.round(f.distance || 0),
                }));
              } catch {
                // One term failing shouldn't empty the whole list.
                return [];
              }
            }),
          );

          // A pharmacy inside a hospital can come back from both searches.
          const byId = new Map<string, (typeof settled)[number][number]>();
          for (const facility of settled.flat()) {
            if (!byId.has(facility.id)) byId.set(facility.id, facility);
          }

          const facilities = [...byId.values()].sort((a, b) => a.distance - b.distance);

          return NextResponse.json({ success: true, data: facilities });
        } catch (err) {
          console.error("TomTom health facility search failed", err);
          return NextResponse.json({ success: true, data: [] });
        }
      }

      default:
        return NextResponse.json({ success: false, message: "Unknown type" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
