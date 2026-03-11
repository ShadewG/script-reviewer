import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(review);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};

  if ("scriptTitle" in body) {
    if (typeof body.scriptTitle !== "string" || body.scriptTitle.length > 200) {
      return Response.json({ error: "Invalid title" }, { status: 400 });
    }
    data.scriptTitle = body.scriptTitle.trim() || null;
  }

  if ("scriptEdits" in body) {
    if (!Array.isArray(body.scriptEdits)) {
      return Response.json({ error: "Invalid edits" }, { status: 400 });
    }
    data.scriptEdits = body.scriptEdits;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const review = await prisma.review.update({
    where: { id },
    data,
    select: { id: true, scriptTitle: true, scriptEdits: true },
  });

  return Response.json(review);
}
