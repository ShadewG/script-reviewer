import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const logs = await prisma.stageLog.findMany({
    where: { reviewId: id },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(logs);
}
