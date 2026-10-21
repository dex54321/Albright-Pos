import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { receiveCustomerPayment } from "@/lib/txns";
import { r2 } from "@/lib/num";

export const maxDuration = 30;

/**
 * Every credit sale still owed (fully or partly) by this customer, with its
 * line items, so the owner can see exactly what was given out on credit,
 * when, and the agreed due date - not just a lump balance.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrors(async () => {
    await requireUser("cashier");
    const id = Number((await params).id);
    const sales = await prisma.sale.findMany({
      where: { customerId: id, creditAmount: { gt: 0 } },
      include: { items: { include: { product: { include: { unit: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return sales.map((s) => ({
      id: s.id,
      no: s.no,
      date: s.createdAt,
      dueDate: s.dueDate,
      creditAmount: s.creditAmount,
      creditReduced: s.creditReduced,
      balance: r2(s.creditAmount - s.creditReduced),
      items: s.items.map((i) => ({ name: i.name, unit: i.product.unit.name, qty: r2((i.qty - i.retQty) * i.factor), price: i.price, total: r2(i.total * (i.qty > 0 ? (i.qty - i.retQty) / i.qty : 0)) })),
    }));
  });
}

/** Records a payment from this customer against their outstanding credit balance. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrors(async () => {
    const actor = await requireUser("cashier");
    const id = Number((await params).id);
    const b = await req.json();
    return receiveCustomerPayment(
      { id: actor.id, name: actor.name },
      { customerId: id, amount: b.amount, method: b.method, ref: b.ref, note: b.note }
    );
  });
}
