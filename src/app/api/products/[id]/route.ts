import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError } from "@/lib/num";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrors(async () => {
    const user = await requireUser("manager");
    const id = Number((await params).id);
    const b = await req.json();
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError("Product not found", { status: 404 });
    if (!String(b.name ?? "").trim()) throw new AppError("Product name is required");
    if (!(Number(b.sellPrice) > 0)) throw new AppError("Enter a selling price");

    await prisma.$transaction(async (tx) => {
      for (const [field, col] of [["buy", "buyPrice"], ["sell", "sellPrice"], ["wholesale", "wholesale"], ["minSell", "minSell"]] as const) {
        const nv = Number(b[col]);
        const ov = (existing as unknown as Record<string, number>)[col];
        if (isFinite(nv) && Math.abs(ov - nv) > 0.004) {
          await tx.priceLog.create({ data: { productId: id, field, oldValue: ov, newValue: nv, why: "Product edit", userId: user.id } });
        }
      }
      await tx.product.update({
        where: { id },
        data: {
          name: b.name,
          categoryId: b.categoryId || null,
          subId: b.subId || null,
          unitId: b.unitId,
          buyPrice: Number(b.buyPrice) || 0,
          sellPrice: Number(b.sellPrice),
          wholesale: Number(b.wholesale) || Number(b.sellPrice),
          minSell: Number(b.minSell) || 0,
          minStock: Number(b.minStock) || 0,
          maxStock: Number(b.maxStock) || 0,
          supplierId: b.supplierId || null,
          brand: b.brand || "",
          description: b.desc || "",
          location: b.location || "",
          vat: b.vat || "std",
          active: b.active !== false,
        },
      });
      await tx.auditLog.create({ data: { userId: user.id, userName: user.name!, action: "Product edit", ref: b.name, details: "Product details updated" } });
    });
    return { ok: true };
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrors(async () => {
    const user = await requireUser("manager");
    const id = Number((await params).id);
    const p = await prisma.product.findUnique({ where: { id } });
    if (!p) throw new AppError("Product not found", { status: 404 });
    const used =
      (await prisma.saleItem.count({ where: { productId: id } })) > 0 ||
      (await prisma.purchaseItem.count({ where: { productId: id } })) > 0;
    if (used) {
      await prisma.product.update({ where: { id }, data: { active: false } });
      await prisma.auditLog.create({ data: { userId: user.id, userName: user.name!, action: "Product edit", ref: p.name, details: "Deactivated (has history)" } });
      return { result: "deactivated" };
    }
    await prisma.stockMovement.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    await prisma.auditLog.create({ data: { userId: user.id, userName: user.name!, action: "Product edit", ref: p.name, details: "Deleted" } });
    return { result: "deleted" };
  });
}
