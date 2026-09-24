import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { dayRangeUTC, r2, todayStr, addDays } from "@/lib/num";

async function calc(from: string, to: string) {
  const range = dayRangeUTC(from, to);
  const sales = await prisma.sale.findMany({ where: { createdAt: range }, include: { items: true } });
  const rets = await prisma.return.findMany({ where: { type: "customer", createdAt: range } });
  const pays = await prisma.payment.findMany({ where: { createdAt: range } });
  const exps = await prisma.expense.findMany({ where: { date: range } });

  const gross = sales.reduce((a, s) => a + s.total, 0);
  const returns = rets.reduce((a, r) => a + r.total, 0);
  const revenue = r2(gross - returns);
  const cogs = r2(
    sales.reduce((a, s) => a + s.items.reduce((b, i) => b + i.costTotal, 0), 0) -
      rets.reduce((a, r) => a + r.cost, 0)
  );
  const expenses = r2(exps.reduce((a, e) => a + e.amount, 0));
  const by = (m: string) => r2(pays.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0));
  return {
    count: sales.length,
    gross: r2(gross),
    returns: r2(returns),
    revenue,
    cogs,
    profit: r2(revenue - cogs),
    expenses,
    net: r2(revenue - cogs - expenses),
    cash: by("cash"),
    mpesa: by("mpesa"),
    card: by("card"),
    credit: r2(sales.reduce((a, s) => a + s.creditAmount, 0)),
  };
}

export async function GET(req: NextRequest) {
  return withErrors(async () => {
    await requireUser("cashier");
    const today = todayStr();
    const [todayC, low, out, recentSales, recentPurchases] = await Promise.all([
      calc(today, today),
      prisma.$queryRaw<{ count: bigint }[]>`select count(*)::bigint as count from "Product" where active = true and stock > 0 and stock <= "minStock"`,
      prisma.product.count({ where: { active: true, stock: { lte: 0 } } }),
      prisma.sale.findMany({ include: { user: true, customer: true }, orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.purchase.findMany({ include: { supplier: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);
    const products = await prisma.product.findMany({ where: { active: true }, select: { stock: true, buyPrice: true, sellPrice: true } });
    const stockCost = r2(products.reduce((a, p) => a + Math.max(p.stock, 0) * p.buyPrice, 0));
    const stockRetail = r2(products.reduce((a, p) => a + Math.max(p.stock, 0) * p.sellPrice, 0));

    const days: { l: string; v: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i);
      const c = await calc(d, d);
      days.push({ l: d.slice(5), v: c.revenue });
    }

    return {
      today: todayC,
      stockCost,
      stockRetail,
      lowStock: Number(low[0]?.count ?? 0),
      outOfStock: out,
      recentSales,
      recentPurchases,
      days,
    };
  });
}
