/**
 * S-10: Standard API response envelope.
 *
 * Shape:
 *   success → { ok: true, data }
 *   failure → { ok: false, error: { code, message, issues? } }
 *
 * Lets clients use a single discriminated union for all API responses
 * and gives zod input validation (S-2 in the P0 cluster) a place to
 * dump `issues` consistently.
 */
import { NextResponse } from "next/server";
import type { ZodIssue } from "zod";

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    issues?: ZodIssue[];
  };
}

export type ApiResponse<T> = ApiOk<T> | ApiError;

export function apiOk<T>(data: T, init?: ResponseInit): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function apiError(
  code: string,
  message: string,
  init?: ResponseInit,
  issues?: ZodIssue[],
): NextResponse<ApiError> {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(issues ? { issues } : {}) } },
    init,
  );
}
