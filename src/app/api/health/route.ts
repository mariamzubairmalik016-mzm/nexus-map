import { NextResponse } from "next/server";
import { db } from "../../../../db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Quick ping to Vercel Postgres to ensure it's alive
    await db.execute(sql`SELECT 1`);
    
    return NextResponse.json({ 
      status: "ok", 
      database: "connected" 
    });
  } catch (error) {
    console.error("Health check database ping failed:", error);
    return NextResponse.json(
      { status: "degraded", database: "disconnected" },
      { status: 503 }
    );
  }
}
