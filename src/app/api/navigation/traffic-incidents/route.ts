import { NextRequest, NextResponse } from "next/server";
import { getTomTomIncidents } from "../../../../services/tomtom.service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get("bbox");
  
  if (!bbox) {
    return NextResponse.json({ success: false, message: "bbox parameter is required" }, { status: 400 });
  }

  try {
    const data = await getTomTomIncidents(bbox);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
