import { NextRequest, NextResponse } from "next/server";
import { fetchTomTomTile } from "../../../../../../../services/tomtom.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    const resolvedParams = await params;
    const tile = await fetchTomTomTile("traffic", resolvedParams.z, resolvedParams.x, resolvedParams.y);
    
    return new NextResponse(tile.bytes, {
      headers: {
        "Content-Type": tile.contentType,
        "Cache-Control": "public, max-age=30",
      }
    });
  } catch (error) {
    return new NextResponse("Tile fetch failed", { status: 500 });
  }
}
