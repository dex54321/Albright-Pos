import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError } from "@/lib/num";

export async function GET(req: NextRequest) {
  return withErrors(async () => {
    await requireUser("cashier");
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const activeOnly = req.nextUrl.searchParams.get("active") !== "0";
    const limit = Math.min(500, Number(req.nextUrl.searchParams.get("limit") ?? 100));
    const where = {
      ...(activeOnly ? { active: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q, mode: "insensitive" as const } },
              { barcode: { contains: q, mode: "insensitive" as const } },
              { brand: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const products = await prisma.product.findMany({
      where,
      include: { category: true, sub: true, unit: true, supplier: true },
      orderBy: { name: "asc" },
      take: limit,
    });
    return products;
  });
}

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("manager");
    const b = await req.json();
    if (!String(b.name ?? "").trim()) throw new AppError("Product name is required");
    if (!(Number(b.sellPrice) > 0)) throw new AppError("Enter a selling price");
    if (Number(b.buyPrice) < 0) throw new AppError("Buying price cannot be negative");

    const sku = String(b.sku ?? "").trim() || undefined;
    const barcode = String(b.barcode ?? "").trim() || undefined;
    if (sku || barcode) {
      const dupe = await prisma.product.findFirst({
        where: { OR: [sku ? { sku } : undefined, barcode ? { barcode } : undefined].filter(Boolean) as object[] },
      });
      if (dupe) throw new AppError(`SKU or barcode already used by "${dupe.name}"`);
    }

    const product = await prisma.$transaction(async (tx) => {
      const count = await tx.product.count();
      const p = await tx.product.create({
        data: {
          sku: sku ?? `HW-${String(count + 1).padStart(5, "0")}`,
          barcode,
          name: b.name,
          categoryId: b.categoryId || null,
          subId: b.subId || null,
          unitId: b.unitId,
          buyPrice: Number(b.buyPrice) || 0,
          sellPrice: Number(b.sellPrice),
          wholesale: Number(b.wholesale) || Number(b.sellPrice),
          minSell: b.minSell != null ? Number(b.minSell) : Number(b.buyPrice) || 0,
          minStock: b.minStock != null ? Number(b.minStock) : 5,
          maxStock: Number(b.maxStock) || 0,
          supplierId: b.supplierId || null,
          brand: b.brand || "",
          description: b.desc || "",
          location: b.location || "",
          vat: b.vat || "std",
          active: b.active !== false,
        },
      });
      const stock = Number(b.stock) || 0;
      if (stock > 0) {
        await tx.product.update({ where: { id: p.id }, data: { stock } });
        await tx.stockMovement.create({
          data: { productId: p.id, type: "adjustment", qty: stock, prevStock: 0, newStock: stock, reason: "Opening stock", userId: user.id },
        });
      }
      await tx.auditLog.create({
        data: { userId: user.id, userName: user.name!, action: "Product creation", ref: p.name, details: `${p.sku} - sell ${p.sellPrice}, buy ${p.buyPrice}` },
      });
      return p;
    });
    return product;
  });
}
