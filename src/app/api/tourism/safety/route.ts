import { NextRequest, NextResponse } from "next/server";

const EMERGENCY_NUMBERS = [
  { name: "Police", number: "15", icon: "Shield" },
  { name: "Ambulance", number: "115", icon: "Ambulance" },
  { name: "Fire Brigade", number: "16", icon: "Flame" },
  { name: "Rescue 1122", number: "1122", icon: "LifeBuoy" },
  { name: "Tourist Police", number: "118", icon: "MapPin" },
];

import { searchCategoryTomTom } from "../../../../services/tomtom.service";

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

        // Map facility types to TomTom category sets
        // 7321 = Hospital, 7326 = Pharmacy, 7322 = Police
        let categorySets = [];
        if (facilityType === "emergency" || facilityType === "hospital") categorySets.push("7321");
        if (facilityType === "pharmacy" || facilityType === "all") categorySets.push("7326");
        if (facilityType === "all") categorySets.push("7321");

        const categorySetString = categorySets.join(",");
        
        try {
          const liveData = await searchCategoryTomTom(categorySetString, userLat, userLng, 25000, 20);
          
          const facilities = liveData.map((f) => {
            const isHosp = f.category?.toLowerCase().includes("hospital") || false;
            return {
              id: f.id,
              name: f.name,
              type: isHosp ? "hospital" : "pharmacy",
              latitude: f.position.latitude,
              longitude: f.position.longitude,
              address: f.address,
              phone: f.phone || "",
              emergency: isHosp,
              open24Hours: true, // Guessed for emergency facilities
              distance: Math.round(f.distance || 0),
            };
          });

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
