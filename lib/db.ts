import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { _prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter } as never);
}

export const prisma = globalForPrisma._prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma._prisma = prisma;
