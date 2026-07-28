import { NextRequest, NextResponse } from "next/server";
import { reverseOsm } from "../../../../services/osmGeocode.service";

export const dynamic = "force-dynamic";

/**
 * Name the place at a coordinate, so a GPS fix can be shown as somewhere
 * recognisable instead of the opaque string "Current Location".
 *
 * Served from the server rather than called from the browser so Nominatim sees
 * one identifying User-Agent, per its usage policy.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ success: false, message: "lat and lon are required" }, { status: 400 });
  }

  const place = await reverseOsm(lat, lon);

  // A missing name is not an error — the caller keeps its existing label.
  return NextResponse.json({ success: true, data: place });
}
