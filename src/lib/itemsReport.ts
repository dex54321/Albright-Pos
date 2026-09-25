import { r2 } from "@/lib/num";

type SaleLike = {
  subtotal: number;
  total: number;
  items: { productId: number; name: string; qty: number; factor: number; total: number; costTotal: number; retQty: number }[];
};

/**
 * Groups sold lines by product: quantity (in the product's base unit), sales,
 * cost and profit. Returned items are taken off, and any whole-sale discount
 * is shared out across the lines, so the totals match the dashboard.
 */
export function aggregateItems(sales: SaleLike[]) {
  const map = new Map<number, { product: string; qty: number; revenue: number; cost: number }>();
  for (const s of sales) {
    const ratio = s.subtotal > 0 ? s.total / s.subtotal : 1;
    for (const i of s.items) {
      const keep = i.qty > 0 ? (i.qty - i.retQty) / i.qty : 0;
      if (keep <= 1e-9) continue;
      const row = map.get(i.productId) ?? { product: i.name, qty: 0, revenue: 0, cost: 0 };
      row.qty += (i.qty - i.retQty) * (i.factor || 1);
      row.revenue += i.total * keep * ratio;
      row.cost += i.costTotal * keep;
      map.set(i.productId, row);
    }
  }
  return [...map.values()]
    .map((r) => ({ product: r.product, qty: r2(r.qty), revenue: r2(r.revenue), cost: r2(r.cost), profit: r2(r.revenue - r.cost) }))
    .sort((a, b) => b.revenue - a.revenue);
}
