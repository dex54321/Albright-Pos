import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { customerBalance } from "@/lib/txns";
import { AppError } from "@/lib/num";

export async function GET(req: NextRequest) {
  return withErrors(async () => {
    await requireUser("cashier");
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const customers = await prisma.customer.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {},
      orderBy: { name: "asc" },
    });
    const withBal = await Promise.all(customers.map(async (c) => ({ ...c, balance: await customerBalance(prisma, c.id) })));
    return withBal;
  });
}

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    await requireUser("cashier");
    const b = await req.json();
    if (!String(b.name ?? "").trim()) throw new AppError("Customer name is required");
    return prisma.customer.create({
      data: { name: b.name, phone: b.phone || "", location: b.location || "", type: b.type || "regular", creditLimit: Number(b.creditLimit) || 0 },
    });
  });
}
