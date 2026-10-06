import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/register"];
const PROTECTED = ["/dashboard", "/profile"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = request.cookies.get("is_authenticated")?.value === "true";

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !authed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (AUTH_ROUTES.some((p) => pathname.startsWith(p)) && authed) {
    // Let the login page verify localStorage tokens client-side; cookie alone is not enough.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
