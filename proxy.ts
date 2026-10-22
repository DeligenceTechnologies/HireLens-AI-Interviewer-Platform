import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: real authorization happens server-side in every
// page and route handler (see lib/auth/session.ts).
const PROTECTED = ["/dashboard", "/jobs", "/candidates", "/interviews", "/templates", "/settings", "/help"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("aii_session");
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/jobs/:path*", "/candidates/:path*", "/interviews/:path*", "/templates/:path*", "/settings/:path*", "/help/:path*"],
};
