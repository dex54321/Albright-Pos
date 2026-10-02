import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { dayRangeUTC, r2, addDays } from "@/lib/num";
import { aggregateItems } from "@/lib/itemsReport";

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
    if (type === "ledger") {
      const sales = await prisma.sale.findMany({
        where: { createdAt: range },
        include: { items: { include: { product: { include: { unit: true } } } } },
        orderBy: { createdAt: "asc" },
      });
      type LedgerRow = { date: string; item: string; unit: string; qty: number | string; buyPrice: number | string; totalBuy: number | string; sellPrice: number | string; totalSell: number | string; profit: number | string };
      const rows: LedgerRow[] = [];
      let dayDate = "";
      let daySales = 0;
      let dayProfit = 0;
      const flushDay = () => {
        if (!dayDate) return;
        rows.push({ date: dayDate, item: "Day total", unit: "", qty: "", buyPrice: "", totalBuy: "", sellPrice: "", totalSell: r2(daySales), profit: r2(dayProfit) });
      };
      for (const s of sales) {
        const ratio = s.subtotal > 0 ? s.total / s.subtotal : 1;
        const d = s.createdAt.toISOString().slice(0, 10);
        if (d !== dayDate) {
          flushDay();
          dayDate = d;
          daySales = 0;
          dayProfit = 0;
        }
        for (const i of s.items) {
          const keep = i.qty > 0 ? (i.qty - i.retQty) / i.qty : 0;
          if (keep <= 1e-9) continue;
          const qty = r2((i.qty - i.retQty) * (i.factor || 1));
          const totalSell = r2(i.total * keep * ratio);
          const totalBuy = r2(i.costTotal * keep);
          const sellPrice = qty ? r2(totalSell / qty) : 0;
          const profit = r2(totalSell - totalBuy);
          rows.push({ date: d, item: i.name, unit: i.product.unit.name, qty, buyPrice: i.product.buyPrice, totalBuy, sellPrice, totalSell, profit });
          daySales += totalSell;
          dayProfit += profit;
        }
      }
      flushDay();
      const grand = rows.filter((r) => r.item === "Day total");
      return {
        rows,
        summary: {
          days: grand.length,
          totalSales: r2(grand.reduce((a, r) => a + (Number(r.totalSell) || 0), 0)),
          totalProfit: r2(grand.reduce((a, r) => a + (Number(r.profit) || 0), 0)),
        },
      };
    }
    if (type === "items") {
      const sales = await prisma.sale.findMany({
        where: { createdAt: range },
        include: { items: { include: { product: { include: { unit: true } } } } },
      });
      const rows = aggregateItems(sales);
      return {
        rows,
        summary: {
          products: rows.length,
          sales: r2(rows.reduce((a, r) => a + r.revenue, 0)),
          profit: r2(rows.reduce((a, r) => a + r.profit, 0)),
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
