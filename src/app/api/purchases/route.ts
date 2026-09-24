import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { createPurchase } from "@/lib/txns";
import { getSettings } from "@/lib/settings";

export async function GET() {
  return withErrors(async () => {
    await requireUser("manager");
    return prisma.purchase.findMany({
      include: { supplier: true, items: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  });
}

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("manager");
    const settings = await getSettings();
    const body = await req.json();
    return createPurchase(
      { id: user.id, name: user.name! },
      body,
      { allowNegative: settings.allowNegative, updateCost: true }
    );
  });
}
