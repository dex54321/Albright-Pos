import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError, num, r2 } from "@/lib/num";

type ImportRow = {
  name: string;
  category?: string;
  unit: string;
  supplier?: string;
  buy: number;
  sell: number;
  stock?: number;
  sku?: string;
  barcode?: string;
  action: "create" | "update" | "skip";
  dupId?: number;
};

/**
 * Bulk-imports products from a spreadsheet the person has already reviewed
 * in the Import wizard (mapped, deduped, and corrected client-side). Each
 * row auto-creates its category/unit/supplier by name if they don't exist
 * yet, matching how the person typed them in their sheet.
 */
export async function POST(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("manager");
    const body = await req.json();
    const items = (body.items ?? []) as ImportRow[];
    if (!Array.isArray(items) || !items.length) throw new AppError("No rows to import");

    let created = 0;
    let updated = 0;
    let skipped = 0;

    await prisma.$transaction(
      async (tx) => {
        const catCache = new Map<string, number>();
        const unitCache = new Map<string, number>();
        const supCache = new Map<string, number>();

        async function categoryId(name?: string): Promise<number | null> {
          const n = (name || "General Hardware").trim();
          if (!n) return null;
          const key = n.toLowerCase();
          if (catCache.has(key)) return catCache.get(key)!;
          let c = await tx.category.findFirst({ where: { name: { equals: n, mode: "insensitive" }, parentId: null } });
          if (!c) c = await tx.category.create({ data: { name: n, parentId: null } });
          catCache.set(key, c.id);
          return c.id;
        }
        async function unitId(name: string): Promise<number> {
          const n = (name || "Piece").trim();
          const key = n.toLowerCase();
          if (unitCache.has(key)) return unitCache.get(key)!;
          let u = await tx.unit.findFirst({ where: { name: { equals: n, mode: "insensitive" } } });
          if (!u) u = await tx.unit.create({ data: { name: n, decimal: /kg|gram|litre|metre/i.test(n) } });
          unitCache.set(key, u.id);
          return u.id;
        }
        async function supplierId(name?: string): Promise<number | null> {
          const n = (name || "").trim();
          if (!n) return null;
          const key = n.toLowerCase();
          if (supCache.has(key)) return supCache.get(key)!;
          let s = await tx.supplier.findFirst({ where: { name: { equals: n, mode: "insensitive" } } });
          if (!s) s = await tx.supplier.create({ data: { name: n } });
          supCache.set(key, s.id);
          return s.id;
        }

        for (const row of items) {
          if (row.action === "skip" || !row.name?.trim()) {
            skipped++;
            continue;
          }
          const buy = num(row.buy);
          const sell = num(row.sell);
          if (!(sell > 0)) {
            skipped++;
            continue;
          }
          const stock = r2(num(row.stock));
          const [catId, unId, supId] = await Promise.all([categoryId(row.category), unitId(row.unit), supplierId(row.supplier)]);

          if (row.action === "update" && row.dupId) {
            const existing = await tx.product.findUnique({ where: { id: row.dupId } });
            if (!existing) {
              skipped++;
              continue;
            }
            if (Math.abs(existing.buyPrice - buy) > 0.004) {
              await tx.priceLog.create({ data: { productId: existing.id, field: "buy", oldValue: existing.buyPrice, newValue: buy, why: "Import", userId: user.id } });
            }
            if (Math.abs(existing.sellPrice - sell) > 0.004) {
              await tx.priceLog.create({ data: { productId: existing.id, field: "sell", oldValue: existing.sellPrice, newValue: sell, why: "Import", userId: user.id } });
            }
            await tx.product.update({
              where: { id: existing.id },
              data: { buyPrice: buy, sellPrice: sell, wholesale: sell, categoryId: catId ?? existing.categoryId, unitId: unId, supplierId: supId ?? existing.supplierId },
            });
            if (stock > 0) {
              const next = r2(existing.stock + stock);
              await tx.product.update({ where: { id: existing.id }, data: { stock: next } });
              await tx.stockMovement.create({
                data: { productId: existing.id, type: "adjustment", qty: stock, prevStock: existing.stock, newStock: next, reason: "Imported stock", userId: user.id },
              });
            }
            updated++;
          } else {
            const count = await tx.product.count();
            const product = await tx.product.create({
              data: {
                sku: row.sku?.trim() || `HW-${String(count + 1).padStart(5, "0")}`,
                barcode: row.barcode?.trim() || null,
                name: row.name.trim(),
                categoryId: catId,
                unitId: unId,
                buyPrice: buy,
                sellPrice: sell,
                wholesale: sell,
                minSell: buy,
                minStock: 5,
                supplierId: supId,
              },
            });
            if (stock > 0) {
              await tx.product.update({ where: { id: product.id }, data: { stock } });
              await tx.stockMovement.create({
                data: { productId: product.id, type: "adjustment", qty: stock, prevStock: 0, newStock: stock, reason: "Opening stock (import)", userId: user.id },
              });
            }
            created++;
          }
        }

        await tx.auditLog.create({
          data: { userId: user.id, userName: user.name, action: "Product creation", ref: "Import", details: `Imported ${created} new, updated ${updated}, skipped ${skipped}` },
        });
      },
      { timeout: 60000 }
    );

    return { created, updated, skipped };
  });
}
