import { NextRequest, NextResponse } from "next/server";
import { searchTomTom } from "../../../../services/tomtom.service";

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
    const tomTomResults = await searchTomTom(query, lat, lon);
    const mapped = tomTomResults.map(item => ({
      ...item,
      source: "tomtom",
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
