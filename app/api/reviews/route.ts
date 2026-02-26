import { prisma } from "@/lib/db";

export async function GET() {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      scriptTitle: true,
      caseState: true,
      caseStatus: true,
      status: true,
      verdict: true,
      riskScore: true,
    },
  });
  return Response.json(reviews);
}
