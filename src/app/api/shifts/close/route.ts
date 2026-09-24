import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError, num, r2 } from "@/lib/num";

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("cashier");
    const b = await req.json();
    const sh = await prisma.shift.findFirst({ where: { userId: user.id, status: "open" } });
    if (!sh) throw new AppError("No open shift to close");
    const counted = num(b.counted);
    if (counted < 0) throw new AppError("Enter the cash counted");

    const cashSales = await prisma.payment.aggregate({ where: { sale: { shiftId: sh.id }, method: "cash" }, _sum: { amount: true } });
    const expected = r2(sh.openCash + (cashSales._sum.amount ?? 0));
    const variance = r2(counted - expected);

    const closed = await prisma.shift.update({
      where: { id: sh.id },
      data: { status: "closed", closedAt: new Date(), expected, counted, variance, notes: b.notes || "" },
    });
    await prisma.auditLog.create({
      data: { userId: user.id, userName: user.name!, action: "Shift closed", ref: String(sh.id), details: `Expected KES ${expected}, counted KES ${counted}, variance KES ${variance}` },
    });
    return closed;
  });
}
