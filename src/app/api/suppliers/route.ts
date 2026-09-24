import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { supplierBalance } from "@/lib/txns";
import { AppError } from "@/lib/num";

export async function GET() {
  return withErrors(async () => {
    await requireUser("cashier");
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
    const withBal = await Promise.all(
      suppliers.map(async (s) => ({ ...s, balance: await supplierBalance(prisma, s.id) }))
    );
    return withBal;
  });
}

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    await requireUser("manager");
    const b = await req.json();
    if (!String(b.name ?? "").trim()) throw new AppError("Supplier name is required");
    return prisma.supplier.create({
      data: { name: b.name, company: b.company || "", phone: b.phone || "", email: b.email || "", location: b.location || "", supplies: b.supplies || "" },
    });
  });
}
