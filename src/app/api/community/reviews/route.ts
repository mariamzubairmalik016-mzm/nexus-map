import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import { tourismReviews } from "../../../../db/schema";
import { eq } from "drizzle-orm";

const SEED_REVIEWS = [
  { id: "rev-1", userId: "seed", userName: "Ali Khan", placeId: "poi-2", placeName: "Badshahi Mosque", rating: 5, title: "Breathtaking Mughal architecture", content: "The sheer scale and intricate craftsmanship left me speechless.", images: "[]", likes: 24, helpfulCount: 12 },
  { id: "rev-2", userId: "seed", userName: "Fatima Zaidi", placeId: "poi-6", placeName: "Attabad Lake", rating: 5, title: "Most beautiful lake in Pakistan", content: "The turquoise waters against the dramatic mountain backdrop is unforgettable.", images: "[]", likes: 31, helpfulCount: 18 },
  { id: "rev-3", userId: "seed", userName: "Usman Tariq", placeId: "poi-7", placeName: "Fairy Meadows", rating: 5, title: "Like walking in a dream", content: "Camping under the stars with Nanga Parbat towering above is incredible.", images: "[]", likes: 45, helpfulCount: 22 },
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get("placeId");

    try {
      let query = db.select().from(tourismReviews);
      if (placeId) query = query.where(eq(tourismReviews.placeId, placeId));
      const data = await query.orderBy(tourismReviews.createdAt);
      if (data.length > 0) {
        const mapped = data.map(r => ({ ...r, images: JSON.parse(r.images || "[]") }));
        return NextResponse.json({ success: true, data: mapped });
      }
    } catch {
      // DB not available, use seed
    }

    let results = SEED_REVIEWS;
    if (placeId) results = results.filter(r => r.placeId === placeId);
    return NextResponse.json({ success: true, data: results });
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
    const inserted = await db.insert(tourismReviews).values({
      userId: userRecord.id,
      userName: body.userName || session.user.name || "User",
      placeId: body.placeId,
      placeName: body.placeName,
      rating: body.rating,
      title: body.title,
      content: body.content,
      images: JSON.stringify(body.images || []),
    }).returning();

    return NextResponse.json({ success: true, data: { ...inserted[0], images: JSON.parse(inserted[0].images || "[]") } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
