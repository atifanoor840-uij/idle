import { NextResponse, type NextRequest } from "next/server";

// Passes the requested path to server layouts so the portal guard can send the
// trader back to the same page after sign-in. Auth itself is checked in
// app/(portal)/layout.tsx (Node runtime, where the session HMAC is verified).
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
