import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { dayRangeUTC, r2, addDays } from "@/lib/num";

export async function GET(req: NextRequest) {
  return withErrors(async () => {
    await requireUser("manager");
    const type = req.nextUrl.searchParams.get("type") ?? "sales";
    const from = req.nextUrl.searchParams.get("from")!;
    const to = req.nextUrl.searchParams.get("to")!;
    const range = dayRangeUTC(from, to);

    if (type === "sales") {
      const sales = await prisma.sale.findMany({ where: { createdAt: range }, include: { user: true, customer: true } });
      return {
        rows: sales.map((s) => ({ no: s.no, date: s.createdAt, cashier: s.user.name, customer: s.customer?.name ?? "Walk-in", total: s.total, status: s.status })),
        summary: { count: sales.length, total: r2(sales.reduce((a, s) => a + s.total, 0)) },
      };
    }
    if (type === "profit") {
      const rows: { date: string; revenue: number; cogs: number; profit: number; expenses: number; net: number }[] = [];
      let d = from;
      let n = 0;
      while (d <= to && n++ < 400) {
        const dr = dayRangeUTC(d, d);
        const sales = await prisma.sale.findMany({ where: { createdAt: dr }, include: { items: true } });
        const rets = await prisma.return.findMany({ where: { type: "customer", createdAt: dr } });
        const exps = await prisma.expense.findMany({ where: { date: dr } });
        const revenue = r2(sales.reduce((a, s) => a + s.total, 0) - rets.reduce((a, r) => a + r.total, 0));
        const cogs = r2(sales.reduce((a, s) => a + s.items.reduce((b, i) => b + i.costTotal, 0), 0) - rets.reduce((a, r) => a + r.cost, 0));
        const expenses = r2(exps.reduce((a, e) => a + e.amount, 0));
        if (sales.length || exps.length) rows.push({ date: d, revenue, cogs, profit: r2(revenue - cogs), expenses, net: r2(revenue - cogs - expenses) });
        d = addDays(d, 1);
      }
      return {
        rows,
        summary: {
          revenue: r2(rows.reduce((a, r) => a + r.revenue, 0)),
          cogs: r2(rows.reduce((a, r) => a + r.cogs, 0)),
          profit: r2(rows.reduce((a, r) => a + r.profit, 0)),
          expenses: r2(rows.reduce((a, r) => a + r.expenses, 0)),
          net: r2(rows.reduce((a, r) => a + r.net, 0)),
        },
      };
    }
    // inventory
    const products = await prisma.product.findMany({ where: { active: true }, include: { category: true, unit: true } });
    const rows = products.map((p) => ({
      name: p.name,
      category: p.category?.name ?? "",
      unit: p.unit.name,
      stock: p.stock,
      buy: p.buyPrice,
      costValue: r2(Math.max(p.stock, 0) * p.buyPrice),
      retailValue: r2(Math.max(p.stock, 0) * p.sellPrice),
    }));
    return {
      rows,
      summary: { costValue: r2(rows.reduce((a, r) => a + r.costValue, 0)), retailValue: r2(rows.reduce((a, r) => a + r.retailValue, 0)) },
    };
  });
}
