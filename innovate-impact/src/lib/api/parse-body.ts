/**
 * S-10 helper: parse a JSON request body against a zod schema.
 *
 * Returns the parsed data on success, or a `NextResponse` carrying the
 * legacy `{ error: "message" }` shape on failure (until the apiError
 * envelope migration ships end-to-end — see S-10 in BACKLOG.md).
 * Routes use the sentinel-style pattern:
 *
 *   const parsed = await parseBody(req, schema);
 *   if (parsed instanceof NextResponse) return parsed;
 *   // parsed is now typed.
 *
 * Validation issues are flattened into a single human-readable string
 * for now; the structured zod issues array is included in the response
 * under `issues` so a future client can opt in.
 */
import { NextResponse } from "next/server";
import type { ZodSchema, z } from "zod";

function formatIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export async function parseBody<S extends ZodSchema>(
  req: Request,
  schema: S,
): Promise<z.infer<S> | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map(formatIssue).join("; ");
    return NextResponse.json(
      { error: message || "Request body failed validation", issues: result.error.issues },
      { status: 400 },
    );
  }
  return result.data;
}

