import { prisma } from "../src/lib/prisma";

async function main() {
  const totalRiders = await prisma.rider.count();
  const completedRiders = await prisma.rider.count({ where: { onboardingCompleted: true } });
  const incompleteRiders = await prisma.rider.findMany({
    where: {
      onboardingCompleted: false,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneCountryCode: true,
          isEmailVerified: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`\n=== RIDER SUMMARY ===`);
  console.log(`Total Riders in DB: ${totalRiders}`);
  console.log(`Onboarding Completed: ${completedRiders}`);
  console.log(`Onboarding Incomplete: ${incompleteRiders.length}\n`);

  const summary = incompleteRiders.map((r, index) => ({
    "#": index + 1,
    riderId: r.id,
    userId: r.userId,
    name: r.user?.name || "(no name)",
    email: r.user?.email || "(no email)",
    phone: r.user?.phone ? `${r.user?.phoneCountryCode || ""} ${r.user?.phone}` : "(no phone)",
    isEmailVerified: r.user?.isEmailVerified ?? false,
    status: r.status,
    isApproved: r.isApproved,
    isSuspended: r.isSuspended,
    createdAt: r.createdAt.toISOString(),
  }));

  console.table(summary);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
