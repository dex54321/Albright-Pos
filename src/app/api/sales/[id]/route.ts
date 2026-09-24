import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError } from "@/lib/num";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrors(async () => {
    const user = await requireUser("cashier");
    const id = Number((await params).id);
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true, payments: true, customer: true, user: true },
    });
    if (!sale) throw new AppError("Sale not found", { status: 404 });
    if (user.role === "cashier" && sale.userId !== user.id) {
      throw new AppError("You do not have access to that sale", { status: 403 });
    }
    return sale;
  });
}
