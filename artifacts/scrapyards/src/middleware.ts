import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // 1. Strip ?sort_by=* → 301
  if (request.nextUrl.searchParams.has("sort_by")) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("sort_by");
    return NextResponse.redirect(url, 301);
  }

  const path = request.nextUrl.pathname;

  // 2. DB-backed legacy redirect fallback
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

  // 3. Catch-all fallback for legacy /blog/metal/* paths whose grade slug
  // doesn't exist in the DB (e.g. /blog/metal/kovar/). Without this they
  // 404; instead, send users to the metal-prices hub.
  if (/^\/blog\/metal\//.test(path)) {
    return NextResponse.redirect(new URL("/scrap-metal-prices/", request.url), 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico).*)",
  ],
};
