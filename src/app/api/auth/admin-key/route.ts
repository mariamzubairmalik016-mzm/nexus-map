import { NextResponse } from "next/server";

import { adminKeyConfigured } from "../../../../services/adminKey";

export const dynamic = "force-dynamic";

/**
 * Whether admin signup keys are switched on for this deployment.
 *
 * Returns a boolean and nothing else — never the key, never its length, never
 * a hint. The signup form uses it only to decide whether to offer the field,
 * so a deployment with no key configured does not show a control that could
 * never work.
 */
export async function GET() {
  return NextResponse.json({ success: true, data: { enabled: adminKeyConfigured() } });
}
