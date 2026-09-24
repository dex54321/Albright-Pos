import { prisma } from "@/lib/prisma";

export async function getSettings() {
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  return s;
}
