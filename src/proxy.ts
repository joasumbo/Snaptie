import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/auth/jwt";

// Auth screens: redirect signed-in users away from them.
const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password"];
// Paths anyone may open without a session (landing page and public scan pages).
const PUBLIC_PATHS = ["/", "/s", ...AUTH_PATHS];

function matches(pathname: string, paths: string[]): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await decodeSession(token);

  // Signed-in users have no reason to see the auth screens.
  if (session && matches(pathname, AUTH_PATHS)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Everything outside the public paths requires a session.
  if (!session && !matches(pathname, PUBLIC_PATHS)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on application routes, skipping Next internals, the API and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
