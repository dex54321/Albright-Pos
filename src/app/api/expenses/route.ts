import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError, dayRangeUTC, num, r2 } from "@/lib/num";

export async function GET(req: NextRequest) {
  return withErrors(async () => {
    await requireUser("cashier");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    return prisma.expense.findMany({
      where: from && to ? { date: dayRangeUTC(from, to) } : {},
      include: { user: true },
      orderBy: { date: "desc" },
    });
  });
}

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("cashier");
    const b = await req.json();
    const amount = r2(num(b.amount));
    if (!(amount > 0)) throw new AppError("Enter the amount");
    if (!b.category) throw new AppError("Choose a category");
    const e = await prisma.expense.create({
      data: {
        category: b.category,
        amount,
        date: b.date ? new Date(b.date + "T12:00:00Z") : new Date(),
        method: b.method || "cash",
        description: b.description || "",
        userId: user.id,
      },
    });
    await prisma.auditLog.create({ data: { userId: user.id, userName: user.name!, action: "Expense", ref: b.category, details: `KES ${amount} ${b.description || ""}` } });
    return e;
  });
}
