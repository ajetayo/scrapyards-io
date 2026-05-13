import { NextResponse } from "next/server";
import { loadPricesForRegion } from "@/lib/calculator";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "US";
  if (!/^[A-Za-z]{2}$/.test(state)) {
    return NextResponse.json({ error: "state must be 2-letter code" }, { status: 400 });
  }
  const data = await loadPricesForRegion(state);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
