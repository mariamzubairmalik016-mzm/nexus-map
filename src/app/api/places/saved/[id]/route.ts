import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../../db";
import { savedPlaces } from "../../../../../db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const id = resolvedParams.id;

  const userRecord = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, session.user.email!),
  });
  
  if (!userRecord) return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });

  try {
    await db.delete(savedPlaces).where(and(eq(savedPlaces.userId, userRecord.id), eq(savedPlaces.id, id)));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
