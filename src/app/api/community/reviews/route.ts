import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import { tourismReviews } from "../../../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { engagementFor, emptyEngagement, viewerFromSession } from "../../../../db/communityEngagement";

/**
 * No seed fallback.
 *
 * This route used to return a hardcoded array when the table was empty, so a
 * fresh deployment showed invented posts attributed to invented people
 * ("Ali Khan", "Fatima Zaidi") as if they were real community activity. An
 * empty table now returns an empty list and the UI shows a real empty state.
 */

const ReviewSchema = z.object({
  placeId: z.string().trim().min(1),
  placeName: z.string().trim().min(1).max(200),
  rating: z.number().int().min(1, "Pick a rating from 1 to 5.").max(5, "Pick a rating from 1 to 5."),
  title: z.string().trim().min(3, "Give your review a short title.").max(120),
  content: z.string().trim().min(10, "Tell us a little more \u2014 at least 10 characters.").max(2000),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get("placeId");

    try {
      // Same reason as tips: .where() changes the builder's type, so the
      // condition is decided before the query is built.
      const where = placeId ? eq(tourismReviews.placeId, placeId) : undefined;
      // Newest first, so a review you just posted appears at the top.
      const data = await db
        .select()
        .from(tourismReviews)
        .where(where)
        .orderBy(desc(tourismReviews.createdAt));

      const viewer = await viewerFromSession();
      const engagement = await engagementFor("review", data.map((r) => r.id), viewer?.id ?? null);

      return NextResponse.json({
        success: true,
        data: data.map((review) => ({
          ...review,
          images: JSON.parse(review.images || "[]"),
          // `mine` drives the "your review" affordance without exposing ids.
          mine: viewer ? review.userId === viewer.id : false,
          engagement: engagement[review.id] ?? emptyEngagement(),
        })),
      });
    } catch (dbError) {
      return NextResponse.json(
        { success: false, message: (dbError as Error).message },
        { status: 500 },
      );
    }
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
      where: (users, { eq }) => eq(users.email, session.user!.email!),
    });
    if (!userRecord) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

    /**
     * Validated before insert. Without this a rating of 0, 99 or "good" went
     * straight into the table and an empty body counted as a review, which
     * makes an average rating meaningless.
     */
    const body = await req.json().catch(() => null);
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Please check your review." },
        { status: 400 },
      );
    }

    // One review per person per place: a second submission edits the first
    // rather than letting one account stack ratings on the same venue.
    const existing = await db
      .select()
      .from(tourismReviews)
      .where(and(eq(tourismReviews.userId, userRecord.id), eq(tourismReviews.placeId, parsed.data.placeId)))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(tourismReviews)
        .set({ rating: parsed.data.rating, title: parsed.data.title, content: parsed.data.content })
        .where(eq(tourismReviews.id, existing[0].id))
        .returning();
      return NextResponse.json({ success: true, data: { ...updated[0], images: [] }, meta: { updated: true } });
    }

    const inserted = await db.insert(tourismReviews).values({
      userId: userRecord.id,
      userName: session.user!.name || userRecord.name || "Traveller",
      placeId: parsed.data.placeId,
      placeName: parsed.data.placeName,
      rating: parsed.data.rating,
      title: parsed.data.title,
      content: parsed.data.content,
      images: JSON.stringify([]),
    }).returning();

    return NextResponse.json({ success: true, data: { ...inserted[0], images: JSON.parse(inserted[0].images || "[]") } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
