import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/cron/sync-data", "/favicon.ico", "/icon.svg"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (await isAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = pathname === "/" ? "" : `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(loginUrl);
}

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    /\.(?:ico|png|jpg|jpeg|gif|webp|svg|css|js|txt|xml)$/.test(pathname)
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
