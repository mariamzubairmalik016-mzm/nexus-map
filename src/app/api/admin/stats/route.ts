import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import { tourismPOIs, roadAlerts, savedRoutes, history } from "../../../../db/schema";
import { count, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const [
      placesResult,
      reportsResult,
      pendingReportsResult,
      offlineJobsResult,
      tripPlansResult,
    ] = await Promise.all([
      db.select({ value: count() }).from(tourismPOIs),
      db.select({ value: count() }).from(roadAlerts),
      db.select({ value: count() }).from(roadAlerts).where(eq(roadAlerts.status, "pending")),
      db.select({ value: count() }).from(savedRoutes).where(eq(savedRoutes.offlineAvailable, 1)),
      db.select({ value: count() }).from(history),
    ]);

    return NextResponse.json({
      places: placesResult[0].value,
      reports: reportsResult[0].value,
      pendingReports: pendingReportsResult[0].value,
      offlineJobs: offlineJobsResult[0].value,
      tripPlans: tripPlansResult[0].value,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
