import { db } from "@/lib/db";
import { priceReportsTable } from "@workspace/db";
import { NextRequest } from "next/server";
import { z } from "zod";

const ReportSchema = z.object({
  yardId: z.coerce.number().int().positive(),
  metalSlug: z.string().min(1).max(60),
  price: z.coerce.number().positive(),
  notes: z.string().max(500).optional(),
  reporterEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await db.insert(priceReportsTable).values({
    yardId: parsed.data.yardId,
    metalSlug: parsed.data.metalSlug,
    price: String(parsed.data.price),
    notes: parsed.data.notes ?? null,
    reporterEmail: parsed.data.reporterEmail ?? null,
    reporterIp: ip,
    isApproved: false,
    reportedOn: new Date().toISOString().slice(0, 10),
  });

  return Response.json({ ok: true }, { status: 201 });
}
