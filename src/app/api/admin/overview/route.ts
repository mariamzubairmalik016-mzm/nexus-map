import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { sql, desc, eq, count } from "drizzle-orm";

import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../../db";
import {
  users,
  profiles,
  savedPlaces,
  savedRoutes,
  history,
  favorites,
  roadAlerts,
  tourismReviews,
  communityTips,
  searchHistory,
  sosAlerts,
} from "../../../../db/schema";

export const dynamic = "force-dynamic";

/**
 * Everything an admin needs about who is using the app and what they did.
 *
 * `/api/admin/stats` returned five bare counts and nothing about users at all,
 * which is why no user data ever reached the admin screen. This returns the
 * people, their per-user activity totals, and the most recent things that
 * happened across the whole install.
 *
 * Access is checked against the `profiles.role` column rather than the JWT
 * alone, so revoking someone's admin rights takes effect on their next request
 * instead of whenever their token happens to expire.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  }

  const me = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  if (me[0]?.role !== "admin") {
    return NextResponse.json({ success: false, message: "Admins only." }, { status: 403 });
  }

  try {
    const [
      totals,
      people,
      recentAlerts,
      recentReviews,
      recentRoutes,
      recentSos,
    ] = await Promise.all([
      // Site-wide totals in one round trip.
      Promise.all([
        db.select({ v: count() }).from(users),
        db.select({ v: count() }).from(savedPlaces),
        db.select({ v: count() }).from(savedRoutes),
        db.select({ v: count() }).from(history),
        db.select({ v: count() }).from(favorites),
        db.select({ v: count() }).from(roadAlerts),
        db.select({ v: count() }).from(tourismReviews),
        db.select({ v: count() }).from(communityTips),
        db.select({ v: count() }).from(searchHistory),
        db.select({ v: count() }).from(sosAlerts),
      ]),

      /**
       * Per-user activity.
       *
       * Correlated subqueries rather than joins: joining six one-to-many
       * tables multiplies rows together, and the counts come out as the
       * product of each other rather than the real totals.
       */
      db.execute(sql`
        SELECT
          u.id,
          u.email,
          COALESCE(p.full_name, u.name)                         AS name,
          COALESCE(p.role, 'user')                              AS role,
          p.city,
          p.country,
          p.created_at                                          AS joined_at,
          (SELECT COUNT(*) FROM saved_places   s WHERE s.user_id = u.id) AS saved_places,
          (SELECT COUNT(*) FROM saved_routes   r WHERE r.user_id = u.id) AS saved_routes,
          (SELECT COUNT(*) FROM history        h WHERE h.user_id = u.id) AS trips,
          (SELECT COUNT(*) FROM favorites      f WHERE f.user_id = u.id) AS favorites,
          (SELECT COUNT(*) FROM road_alerts    a WHERE a.user_id = u.id) AS alerts,
          (SELECT COUNT(*) FROM tourism_reviews v WHERE v.user_id = u.id) AS reviews
        FROM "user" u
        LEFT JOIN profiles p ON p.id = u.id
        ORDER BY p.created_at DESC NULLS LAST
      `),

      db
        .select({
          id: roadAlerts.id,
          type: roadAlerts.type,
          severity: roadAlerts.severity,
          description: roadAlerts.description,
          status: roadAlerts.status,
          upvotes: roadAlerts.upvotes,
          downvotes: roadAlerts.downvotes,
          createdAt: roadAlerts.createdAt,
        })
        .from(roadAlerts)
        .orderBy(desc(roadAlerts.createdAt))
        .limit(10),

      db
        .select({
          id: tourismReviews.id,
          userName: tourismReviews.userName,
          placeName: tourismReviews.placeName,
          rating: tourismReviews.rating,
          title: tourismReviews.title,
          createdAt: tourismReviews.createdAt,
        })
        .from(tourismReviews)
        .orderBy(desc(tourismReviews.createdAt))
        .limit(10),

      db
        .select({
          id: savedRoutes.id,
          title: savedRoutes.title,
          originName: savedRoutes.originName,
          destinationName: savedRoutes.destinationName,
          distanceMeters: savedRoutes.distanceMeters,
          createdAt: savedRoutes.createdAt,
        })
        .from(savedRoutes)
        .orderBy(desc(savedRoutes.createdAt))
        .limit(10),

      db
        .select({
          id: sosAlerts.id,
          userId: sosAlerts.userId,
          latitude: sosAlerts.latitude,
          longitude: sosAlerts.longitude,
          message: sosAlerts.message,
          status: sosAlerts.status,
          createdAt: sosAlerts.createdAt,
        })
        .from(sosAlerts)
        .orderBy(desc(sosAlerts.createdAt))
        .limit(10),
    ]);

    const [
      userCount,
      placeCount,
      routeCount,
      tripCount,
      favouriteCount,
      alertCount,
      reviewCount,
      tipCount,
      searchCount,
      sosCount,
    ] = totals.map((r) => r[0]?.v ?? 0);

    // drizzle's execute() shape differs between drivers.
    const rows = (Array.isArray(people) ? people : (people as { rows?: unknown[] }).rows) ?? [];

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          users: userCount,
          savedPlaces: placeCount,
          savedRoutes: routeCount,
          trips: tripCount,
          favorites: favouriteCount,
          alerts: alertCount,
          reviews: reviewCount,
          tips: tipCount,
          searches: searchCount,
          sos: sosCount,
        },
        users: rows,
        recent: {
          alerts: recentAlerts,
          reviews: recentReviews,
          routes: recentRoutes,
          sos: recentSos,
        },
      },
    });
  } catch (error) {
    console.error("[admin/overview]", error);
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
