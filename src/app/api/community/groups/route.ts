import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import { travelGroups, groupMembers } from "../../../../db/schema";
import { eq, like, or, sql } from "drizzle-orm";

const SEED_GROUPS = [
  { id: "grp-1", name: "Pakistan Travel Explorers", description: "A community for travelers exploring the beauty of Pakistan. Share experiences, tips, and plan group trips!", memberCount: 1245, isPublic: 1, tags: JSON.stringify(["pakistan","travel","adventure"]), createdBy: "seed" },
  { id: "grp-2", name: "Hunza Valley Lovers", description: "Dedicated to everyone who fell in love with Hunza. Share photos, experiences, and local insights.", memberCount: 876, isPublic: 1, tags: JSON.stringify(["hunza","nature","photography"]), createdBy: "seed" },
  { id: "grp-3", name: "Budget Backpackers Pakistan", description: "Travel Pakistan on a budget! Share tips on affordable stays, cheap eats, and low-cost adventures.", memberCount: 543, isPublic: 1, tags: JSON.stringify(["budget","backpacking","tips"]), createdBy: "seed" },
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    try {
      let query = db.select().from(travelGroups);
      if (search) {
        const q = search.toLowerCase();
        query = query.where(
          or(
            like(sql`LOWER(${travelGroups.name})`, `%${q}%`),
            like(sql`LOWER(${travelGroups.description})`, `%${q}%`)
          )
        );
      }
      const data = await query.orderBy(travelGroups.memberCount);
      if (data.length > 0) {
        const mapped = data.map(g => ({ ...g, tags: JSON.parse(g.tags || "[]") }));
        return NextResponse.json({ success: true, data: mapped });
      }
    } catch {
      // DB not available
    }

    let results = [...SEED_GROUPS];
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(g => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
    }
    return NextResponse.json({ success: true, data: results.map(g => ({ ...g, tags: JSON.parse(g.tags) })) });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const userRecord = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, session.user.email!),
    });
    if (!userRecord) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

    const body = await req.json();
    const inserted = await db.insert(travelGroups).values({
      name: body.name,
      description: body.description,
      coverImage: body.coverImage,
      tags: JSON.stringify(body.tags || []),
      createdBy: userRecord.id,
      memberCount: 1,
      isPublic: body.isPublic !== false ? 1 : 0,
    }).returning();

    // Add creator as member
    await db.insert(groupMembers).values({
      groupId: inserted[0].id,
      userId: userRecord.id,
      role: "admin",
    });

    return NextResponse.json({
      success: true,
      data: { ...inserted[0], tags: JSON.parse(inserted[0].tags || "[]") }
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
