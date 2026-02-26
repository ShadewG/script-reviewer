import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { STATE_DEFAMATION_DATA } from "./state-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  console.log("Seeding state defamation laws...");

  for (const law of STATE_DEFAMATION_DATA) {
    await prisma.stateDefamationLaw.upsert({
      where: { state: law.state },
      update: {
        ...law,
        lastVerified: new Date(),
      },
      create: {
        ...law,
        lastVerified: new Date(),
      },
    });
    console.log(`  Seeded: ${law.state} (${law.abbrev})`);
  }

  console.log(`Done. ${STATE_DEFAMATION_DATA.length} states seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
