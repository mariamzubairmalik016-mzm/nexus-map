import { NextRequest, NextResponse } from "next/server";
import { calculateTomTomRoutes } from "../../../../services/tomtom.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Ensure defaults that the Express zod validation provided
    if (!body.travelMode) body.travelMode = "car";
    if (typeof body.avoidTolls !== "boolean") body.avoidTolls = false;
    if (typeof body.avoidFerries !== "boolean") body.avoidFerries = false;
    if (body.routeType !== "shortest") body.routeType = "fastest";
    if (typeof body.alternatives !== "number") body.alternatives = 2;

    const data = await calculateTomTomRoutes(body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
