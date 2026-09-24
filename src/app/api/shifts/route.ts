import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError, num, r2 } from "@/lib/num";

/**
 * Cash reconciliation for a shift. Only counts sales linked to this shift
 * (via Sale.shiftId, set when the sale is created while a shift is open) -
 * debt payments, expenses and supplier payments are tracked shop-wide in
 * this version rather than per-shift; see the shop-wide reports for those.
 */
async function shiftFigures(shiftId: number) {
  const [cashSales, mpesa, card, credit] = await Promise.all([
    prisma.payment.aggregate({ where: { sale: { shiftId }, method: "cash" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { sale: { shiftId }, method: "mpesa" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { sale: { shiftId }, method: "card" }, _sum: { amount: true } }),
    prisma.sale.aggregate({ where: { shiftId }, _sum: { creditAmount: true } }),
  ]);
  const shift = await prisma.shift.findUniqueOrThrow({ where: { id: shiftId } });
  const cash = r2(cashSales._sum.amount ?? 0);
  const count = await prisma.sale.count({ where: { shiftId } });
  const expected = r2(shift.openCash + cash);
  return {
    cashSales: cash,
    mpesa: r2(mpesa._sum.amount ?? 0),
    card: r2(card._sum.amount ?? 0),
    credit: r2(credit._sum.creditAmount ?? 0),
    count,
    expected,
  };
}

export async function GET(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("cashier");
    const mine = req.nextUrl.searchParams.get("mine") === "1";
    const open = await prisma.shift.findFirst({ where: { userId: user.id, status: "open" } });
    const figures = open ? await shiftFigures(open.id) : null;
    const history = await prisma.shift.findMany({
      where: mine ? { userId: user.id } : user.role === "cashier" ? { userId: user.id } : {},
      include: { user: true },
      orderBy: { openedAt: "desc" },
      take: 100,
    });
    return { open, figures, history };
  });
}

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("cashier");
    const b = await req.json();
    const existing = await prisma.shift.findFirst({ where: { userId: user.id, status: "open" } });
    if (existing) throw new AppError("You already have an open shift");
    const openCash = num(b.openCash);
    if (openCash < 0) throw new AppError("Opening cash cannot be negative");
    const sh = await prisma.shift.create({ data: { userId: user.id, openCash } });
    await prisma.auditLog.create({ data: { userId: user.id, userName: user.name!, action: "Shift opened", ref: String(sh.id), details: `Opening cash KES ${openCash}` } });
    return sh;
  });
}
