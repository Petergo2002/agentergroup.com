import { NextResponse } from "next/server";

/**
 * Standardizes API error responses across the application.
 */
export function errorResponse(
  message: string, 
  status: number = 400, 
  code?: string
) {
  return NextResponse.json(
    { 
      error: message,
      code: code ?? (status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST")
    }, 
    { status }
  );
}

/**
 * Standardizes API success responses.
 */
export function successResponse(data: unknown = { ok: true }, status: number = 200) {
  return NextResponse.json(data, { status });
}
