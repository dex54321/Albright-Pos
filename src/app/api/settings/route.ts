import { NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";

export async function GET() {
  return withErrors(async () => {
    await requireUser("cashier");
    return getSettings();
  });
}

export async function PUT(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("manager");
    const b = await req.json();
    const s = await prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...b },
      update: b,
    });
    await prisma.auditLog.create({ data: { userId: user.id, userName: user.name!, action: "Settings", ref: "Shop settings", details: "Settings updated" } });
    return s;
  });
}
