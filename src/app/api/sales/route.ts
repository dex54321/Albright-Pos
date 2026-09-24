import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { createSale } from "@/lib/txns";
import { getSettings } from "@/lib/settings";
import { dayRangeUTC } from "@/lib/num";

export async function GET(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("cashier");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const sales = await prisma.sale.findMany({
      where: {
        ...(from && to ? { createdAt: dayRangeUTC(from, to) } : {}),
        ...(user.role === "cashier" ? { userId: user.id } : {}),
        ...(q
          ? { OR: [{ no: { contains: q, mode: "insensitive" as const } }, { customer: { name: { contains: q, mode: "insensitive" as const } } }] }
          : {}),
      },
      include: { user: true, customer: true, payments: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return sales;
  });
}

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("cashier");
    const settings = await getSettings();
    const body = await req.json();
    const sale = await createSale(
      { id: user.id, name: user.name!, role: user.role },
      body,
      { allowNegative: settings.allowNegative, creditDays: settings.creditDays }
    );
    return sale;
  });
}
