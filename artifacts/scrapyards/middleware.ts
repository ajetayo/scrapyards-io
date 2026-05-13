import { NextRequest, NextResponse } from "next/server";
import {
  determineRegion,
  REGION_HEADER,
  GPC_HEADER,
  REGION_COOKIE_NAME,
  REGION_COOKIE_MAX_AGE,
} from "./lib/consent/region-from-request";

export async function middleware(request: NextRequest) {
  // 1. Strip ?sort_by=* → 301
  if (request.nextUrl.searchParams.has("sort_by")) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("sort_by");
    return NextResponse.redirect(url, 301);
  }

  const path = request.nextUrl.pathname;

  // 2. DB-backed legacy redirect fallback (returns early without geo work)
  try {
    const apiUrl = new URL("/api/legacy-redirect/", request.url);
    const search = request.nextUrl.search ?? "";
    apiUrl.searchParams.set("path", path + search);

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(apiUrl.toString(), { signal: ctrl.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as { targetPath?: string; statusCode?: number };
      if (data.targetPath) {
        return NextResponse.redirect(new URL(data.targetPath, request.url), {
          status: data.statusCode ?? 301,
        });
      }
    }
  } catch {
    // fall through
  }

  // 3. Catch-all fallback for legacy /blog/metal/* paths
  if (/^\/blog\/metal\//.test(path)) {
    return NextResponse.redirect(new URL("/scrap-metal-prices/", request.url), 301);
  }

  // 4. Region detection — sets x-consent-region request header for SSR
  //    and stashes a 1-hour sy_region cookie so subsequent requests skip
  //    the network lookup entirely.
  const decision = await determineRegion(request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REGION_HEADER, decision.region);
  if (decision.gpc) requestHeaders.set(GPC_HEADER, "1");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Expose region on the response so clients (and curl-based smoke tests)
  // can see what was decided without parsing HTML.
  response.headers.set(REGION_HEADER, decision.region);

  // Only refresh the cookie when we just resolved (avoid rewriting on every
  // request that already has the cookie).
  if (decision.source !== "cookie") {
    response.cookies.set({
      name: REGION_COOKIE_NAME,
      value: decision.region,
      maxAge: REGION_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico).*)",
  ],
};
