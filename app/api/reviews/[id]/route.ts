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
  const { scriptTitle } = body;

  if (typeof scriptTitle !== "string" || scriptTitle.length > 200) {
    return Response.json({ error: "Invalid title" }, { status: 400 });
  }

  const review = await prisma.review.update({
    where: { id },
    data: { scriptTitle: scriptTitle.trim() || null },
    select: { id: true, scriptTitle: true },
  });

  return Response.json(review);
}
