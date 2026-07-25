import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../db";
import { roadAlerts } from "../../../db/schema";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  
  const latitude = Number(latParam ?? 24.8607);
  const longitude = Number(lngParam ?? 67.0011);
  const includeDemo = searchParams.get("includeDemo") === "true";

  try {
    const dataFromDb = await db.select().from(roadAlerts);
    // map DB to RoadAlert schema
    const communityAlerts = dataFromDb.map(alert => ({
      id: alert.id,
      title: alert.type,
      description: alert.description || "",
      severity: alert.severity,
      type: alert.type,
      latitude: alert.latitude,
      longitude: alert.longitude,
      source: "community",
      updatedAt: alert.createdAt.toISOString(),
      upvotes: alert.upvotes,
      downvotes: alert.downvotes,
      status: alert.status,
    }));

    const demoAlerts = includeDemo ? [
      {
        id: "alert-1",
        title: "Traffic congestion reported",
        description: "Traffic is moving slowly near the selected route. Allow extra travel time.",
        severity: "medium",
        type: "traffic",
        latitude: latitude + 0.01,
        longitude: longitude + 0.01,
        source: "demo",
        updatedAt: new Date().toISOString(),
      },
      {
        id: "alert-2",
        title: "Road condition advisory",
        description: "This is demo alert data until a live traffic provider is connected.",
        severity: "low",
        type: "construction",
        latitude: latitude - 0.01,
        longitude: longitude - 0.01,
        source: "demo",
        updatedAt: new Date().toISOString(),
      },
    ] : [];

    const finalAlerts = [...communityAlerts, ...demoAlerts];

    return NextResponse.json({
      success: true,
      data: finalAlerts,
      meta: {
        sources: {
          community: { count: communityAlerts.length },
          demo: { count: demoAlerts.length }
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const userRecord = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, session.user.email!),
  });
  
  if (!userRecord) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

  try {
    const body = await req.json();
    const inserted = await db.insert(roadAlerts).values({
      userId: userRecord.id,
      type: body.type,
      severity: body.severity,
      description: body.description,
      latitude: body.latitude,
      longitude: body.longitude,
      status: "active",
      upvotes: 0,
      downvotes: 0,
    }).returning();

    return NextResponse.json({ success: true, data: inserted[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
