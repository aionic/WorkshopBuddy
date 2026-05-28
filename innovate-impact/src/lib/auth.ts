/**
 * P0-1: AuthN + AuthZ.
 *
 * Reads the caller identity from Azure Container Apps Easy Auth headers
 * (`X-MS-CLIENT-PRINCIPAL-ID`, `X-MS-CLIENT-PRINCIPAL-NAME`,
 * `X-MS-CLIENT-PRINCIPAL`) and exposes helpers for API routes.
 *
 * Local dev bypass: when `NODE_ENV !== 'production'` AND no Easy Auth
 * headers are present, returns the user identified by
 *   DEV_AUTH_BYPASS_OID  (Entra oid)
 *   DEV_AUTH_BYPASS_UPN  (UPN/email, optional)
 *   DEV_AUTH_BYPASS_NAME (display name, optional)
 *
 * Returns `404` (not `403`) on cross-owner access to avoid project
 * enumeration. Returns `401` when the caller is unauthenticated.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface AuthUser {
  /** Entra object id (`oid` claim). Stable across UPN renames. */
  oid: string;
  /** UPN / email if Easy Auth provided one. */
  upn?: string;
  /** Display name if available. */
  name?: string;
  /** True when the user came from the local-dev bypass, not Easy Auth. */
  bypass: boolean;
}

/** Unique symbol thrown by `requireUser` / `assertProjectAccess` so routes
 *  can `try`/`catch` and return the carried `NextResponse` directly. */
export class AuthError extends Error {
  constructor(public readonly response: NextResponse) {
    super("AuthError");
    this.name = "AuthError";
  }
}

function decodeEasyAuthPrincipal(b64: string): { name?: string; upn?: string } {
  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(json) as {
      claims?: Array<{ typ?: string; val?: string }>;
    };
    const claim = (typ: string) =>
      parsed.claims?.find((c) => c.typ === typ)?.val;
    return {
      name: claim("name"),
      upn:
        claim("preferred_username") ??
        claim("upn") ??
        claim("emails") ??
        claim("email"),
    };
  } catch {
    return {};
  }
}

/**
 * Returns the authenticated user from the incoming request, or `null` if
 * the request is unauthenticated (and no local-dev bypass is configured).
 */
export function getCurrentUser(req: Request): AuthUser | null {
  const h = req.headers;
  const oid = h.get("x-ms-client-principal-id");
  if (oid) {
    const principal = h.get("x-ms-client-principal");
    const decoded = principal ? decodeEasyAuthPrincipal(principal) : {};
    return {
      oid,
      upn: h.get("x-ms-client-principal-name") ?? decoded.upn ?? undefined,
      name: decoded.name,
      bypass: false,
    };
  }

  // Local-dev bypass: never honored in production.
  if (process.env.NODE_ENV !== "production") {
    const bypassOid = process.env.DEV_AUTH_BYPASS_OID;
    if (bypassOid) {
      return {
        oid: bypassOid,
        upn: process.env.DEV_AUTH_BYPASS_UPN || undefined,
        name: process.env.DEV_AUTH_BYPASS_NAME || undefined,
        bypass: true,
      };
    }
  }

  return null;
}

/**
 * Throws `AuthError(401)` when the caller is unauthenticated.
 */
export function requireUser(req: Request): AuthUser {
  const user = getCurrentUser(req);
  if (!user) {
    throw new AuthError(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }
  return user;
}

/**
 * Loads the project and verifies the caller owns it. Returns the row.
 * Returns `404` on missing-or-not-owned to prevent enumeration.
 */
export async function assertProjectAccess(
  projectId: string,
  user: AuthUser,
): Promise<{ id: string; ownerId: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });
  if (!project || project.ownerId !== user.oid) {
    throw new AuthError(
      NextResponse.json({ error: "Project not found" }, { status: 404 }),
    );
  }
  return project;
}

/**
 * Verifies the artifact belongs to a project the caller can access.
 * Returns `{ projectId }` on success.
 */
export async function assertArtifactAccess(
  artifactId: string,
  user: AuthUser,
): Promise<{ projectId: string }> {
  const a = await prisma.artifact.findUnique({
    where: { id: artifactId },
    select: { projectId: true, project: { select: { ownerId: true } } },
  });
  if (!a || a.project.ownerId !== user.oid) {
    throw new AuthError(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }
  return { projectId: a.projectId };
}

/**
 * Verifies the workshop input belongs to a project the caller can access.
 */
export async function assertInputAccess(
  inputId: string,
  user: AuthUser,
): Promise<{ projectId: string }> {
  const i = await prisma.workshopInput.findUnique({
    where: { id: inputId },
    select: { projectId: true, project: { select: { ownerId: true } } },
  });
  if (!i || i.project.ownerId !== user.oid) {
    throw new AuthError(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }
  return { projectId: i.projectId };
}

/**
 * Wraps an API handler so any `AuthError` thrown by `requireUser` /
 * `assertProjectAccess` / `assertArtifactAccess` / `assertInputAccess`
 * is automatically turned into the carried `NextResponse`.
 */
export function withAuth<TArgs extends unknown[]>(
  handler: (req: Request, user: AuthUser, ...rest: TArgs) => Promise<Response>,
): (req: Request, ...rest: TArgs) => Promise<Response> {
  return async (req: Request, ...rest: TArgs) => {
    try {
      const user = requireUser(req);
      return await handler(req, user, ...rest);
    } catch (err) {
      if (err instanceof AuthError) return err.response;
      throw err;
    }
  };
}
