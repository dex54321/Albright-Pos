import { Prisma, PrismaClient, MoveType, PayMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { r2, num, AppError, pad6, addDays, todayStr } from "@/lib/num";

type TX = Prisma.TransactionClient | PrismaClient;

/** Records a stock movement and updates Product.stock. Throws if it would go negative and negative stock isn't allowed. */
export async function moveStock(
  tx: TX,
  opts: {
    productId: number;
    delta: number;
    type: MoveType;
    reason?: string;
    ref?: string;
    userId: number;
    allowNegative: boolean;
  }
) {
  const p = await tx.product.findUnique({ where: { id: opts.productId } });
  if (!p) throw new AppError("Product not found");
  const next = r2(p.stock + opts.delta);
  if (next < -1e-9 && !opts.allowNegative) {
    throw new AppError(`Not enough stock: ${p.name} has ${p.stock} left`);
  }
  await tx.product.update({ where: { id: p.id }, data: { stock: next } });
  await tx.stockMovement.create({
    data: {
      productId: p.id,
      type: opts.type,
      qty: opts.delta,
      prevStock: p.stock,
      newStock: next,
      reason: opts.reason ?? "",
      ref: opts.ref ?? "",
      userId: opts.userId,
    },
  });
  return next;
}

async function audit(
  tx: TX,
  opts: { userId: number; userName: string; action: string; ref?: string; details?: string }
) {
  await tx.auditLog.create({
    data: {
      userId: opts.userId,
      userName: opts.userName,
      action: opts.action,
      ref: opts.ref ?? "",
      details: opts.details ?? "",
    },
  });
}

export type SaleLineInput = {
  productId: number;
  qty: number;
  price: number;
  listPrice: number;
  disc: number;
  unit: string;
  factor: number;
};

export type CreateSaleInput = {
  items: SaleLineInput[];
  discount?: number;
  customerId?: number | null;
  cash?: number;
  mpesa?: number;
  mpesaRef?: string;
  card?: number;
  cardRef?: string;
  credit?: number;
  dueDate?: string;
  approvedBy?: number | null;
};

/**
 * Creates a sale atomically: validates stock and prices, decrements stock,
 * writes payments, updates the customer's credit balance, and audits it.
 * Mirrors the single-file app's createSale() logic 1:1.
 */
export async function createSale(
  actor: { id: number; name: string; role: string },
  input: CreateSaleInput,
  settings: { allowNegative: boolean; creditDays: number }
) {
  if (!input.items?.length) throw new AppError("The cart is empty");

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: input.items.map((i) => i.productId) } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const need = new Map<number, number>();
    const lines: {
      productId: number;
      name: string;
      unit: string;
      factor: number;
      qty: number;
      price: number;
      listPrice: number;
      disc: number;
      total: number;
      costTotal: number;
    }[] = [];

    for (const it of input.items) {
      const p = byId.get(it.productId);
      if (!p || !p.active) throw new AppError("A product in the cart is no longer available");
      const qty = num(it.qty);
      if (!(qty > 0)) throw new AppError(`Enter a quantity for ${p.name}`);
      const price = num(it.price);
      const disc = num(it.disc);
      if (price < 0 || disc < 0) throw new AppError("Prices and discounts cannot be negative");
      const total = r2(qty * price - disc);
      if (total < 0) throw new AppError(`The discount on ${p.name} is bigger than the line total`);
      const factor = it.factor || 1;
      need.set(p.id, (need.get(p.id) ?? 0) + qty * factor);
      lines.push({
        productId: p.id,
        name: p.name,
        unit: it.unit || "",
        factor,
        qty,
        price,
        listPrice: num(it.listPrice) || price,
        disc,
        total,
        costTotal: r2(qty * factor * p.buyPrice),
      });
      subtotal += total;
    }
    subtotal = r2(subtotal);

    if (!settings.allowNegative) {
      for (const [pid, qty] of need) {
        const p = byId.get(pid)!;
        if (qty > p.stock + 1e-9) {
          throw new AppError(`Not enough stock: ${p.name} has ${p.stock} left`);
        }
      }
    }

    const discount = r2(Math.min(Math.max(num(input.discount), 0), subtotal));
    const total = r2(subtotal - discount);

    // Below-minimum-price check -> requires manager approval
    const ratio = subtotal > 0 ? total / subtotal : 1;
    let belowMin = false;
    for (const l of lines) {
      const p = byId.get(l.productId)!;
      const eff = (l.total * ratio) / (l.qty * l.factor);
      if (p.minSell > 0 && eff < p.minSell - 0.005) belowMin = true;
    }
    const isManager = actor.role === "admin" || actor.role === "manager";
    const approver = input.approvedBy ?? (isManager ? actor.id : 0);
    if (belowMin && !approver) {
      throw new AppError(
        "Some items are below their minimum selling price. A manager must approve this sale.",
        { needApproval: true }
      );
    }

    const cashIn = num(input.cash);
    const mp = num(input.mpesa);
    const cd = num(input.card);
    const cr = num(input.credit);
    if ([cashIn, mp, cd, cr].some((x) => x < 0)) throw new AppError("Payment amounts cannot be negative");
    const cashDue = r2(total - mp - cd - cr);
    if (cashDue < -0.005) throw new AppError("Payments add up to more than the total");
    if (cashDue > 0.005 && cashIn < cashDue - 0.005) {
      throw new AppError(`Cash received is short by KES ${(cashDue - cashIn).toFixed(2)}`);
    }
    const change = cashDue > 0.005 ? r2(cashIn - cashDue) : 0;
    if (mp > 0 && !String(input.mpesaRef ?? "").trim()) {
      throw new AppError("Enter the M-Pesa transaction code");
    }

    let customer = null as null | { id: number; name: string; creditLimit: number };
    if (cr > 0) {
      if (!input.customerId) throw new AppError("Choose a customer for the credit part of this sale");
      const c = await tx.customer.findUnique({ where: { id: input.customerId } });
      if (!c) throw new AppError("Customer not found");
      customer = { id: c.id, name: c.name, creditLimit: c.creditLimit };
      if (c.creditLimit > 0) {
        const bal = await customerBalance(tx, c.id);
        if (bal + cr > c.creditLimit + 0.005 && !approver) {
          throw new AppError(
            `This would take ${c.name} over the credit limit of KES ${c.creditLimit}. A manager must approve.`,
            { needApproval: true }
          );
        }
      }
    }

    const seq = await nextSeq(tx, "sale");
    const no = "RCP-" + pad6(seq);
    const openShift = await tx.shift.findFirst({ where: { userId: actor.id, status: "open" } });

    const sale = await tx.sale.create({
      data: {
        no,
        userId: actor.id,
        customerId: (cr > 0 ? customer?.id : input.customerId) ?? null,
        shiftId: openShift?.id ?? null,
        subtotal,
        discount,
        total,
        cashReceived: cashDue > 0.005 ? cashIn : 0,
        change,
        creditAmount: cr,
        creditReduced: 0,
        dueDate: cr > 0 ? new Date((input.dueDate || addDays(todayStr(), settings.creditDays)) + "T12:00:00Z") : null,
        status: "completed",
        approvedBy: belowMin ? approver : null,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            unit: l.unit,
            factor: l.factor,
            qty: l.qty,
            price: l.price,
            listPrice: l.listPrice,
            disc: l.disc,
            total: l.total,
            costTotal: l.costTotal,
          })),
        },
      },
      include: { items: true },
    });

    const payData: { saleId: number; method: PayMethod; amount: number; ref?: string }[] = [];
    if (cashDue > 0.005) payData.push({ saleId: sale.id, method: "cash", amount: cashDue });
    if (mp > 0) payData.push({ saleId: sale.id, method: "mpesa", amount: mp, ref: (input.mpesaRef || "").trim().toUpperCase() });
    if (cd > 0) payData.push({ saleId: sale.id, method: "card", amount: cd, ref: input.cardRef || "" });
    for (const p of payData) await tx.payment.create({ data: p });

    for (const [pid, qty] of need) {
      await moveStock(tx, {
        productId: pid,
        delta: -qty,
        type: "sale",
        reason: "Sale " + no,
        ref: no,
        userId: actor.id,
        allowNegative: settings.allowNegative,
      });
    }

    await audit(tx, {
      userId: actor.id,
      userName: actor.name,
      action: "Sale",
      ref: no,
      details: `KES ${total} - ${lines.length} item(s)${cr > 0 ? " - credit KES " + cr : ""}`,
    });
    for (const l of lines) {
      if (Math.abs(l.price - l.listPrice) > 0.004) {
        await audit(tx, {
          userId: actor.id,
          userName: actor.name,
          action: "Price change",
          ref: no,
          details: `${l.name}: list ${l.listPrice} -> sold at ${l.price}`,
        });
      }
    }
    return sale;
  });
}

/**
 * Atomically increments and returns a named counter (RCP/PUR/RET numbers).
 * Uses Postgres's UPDATE ... RETURNING under the surrounding transaction,
 * so two simultaneous sales can never get the same receipt number.
 */
async function nextSeq(tx: TX, key: string): Promise<number> {
  await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  const row = await tx.counter.findUniqueOrThrow({ where: { key } });
  return row.value;
}

export async function customerBalance(tx: TX, customerId: number): Promise<number> {
  const sales = await tx.sale.aggregate({
    where: { customerId },
    _sum: { creditAmount: true, creditReduced: true },
  });
  const pays = await tx.customerPayment.aggregate({
    where: { customerId },
    _sum: { amount: true },
  });
  const rets = await tx.return.aggregate({
    where: { type: "customer", customerId },
    _sum: { storeCredit: true },
  });
  const credit = (sales._sum.creditAmount ?? 0) - (sales._sum.creditReduced ?? 0);
  const paid = (pays._sum.amount ?? 0) + (rets._sum.storeCredit ?? 0);
  return r2(credit - paid);
}

export async function receiveCustomerPayment(
  actor: { id: number; name: string },
  input: { customerId: number; amount: number; method: PayMethod; ref?: string; note?: string }
) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!c) throw new AppError("Choose a customer");
    const amount = r2(num(input.amount));
    if (!(amount > 0)) throw new AppError("Enter the amount received");
    const bal = await customerBalance(tx, c.id);
    if (amount > bal + 0.005) throw new AppError(`That is more than the balance owed (KES ${bal})`);
    if (input.method === "mpesa" && !String(input.ref ?? "").trim()) {
      throw new AppError("Enter the M-Pesa transaction code");
    }
    const rec = await tx.customerPayment.create({
      data: {
        customerId: c.id,
        amount,
        method: input.method,
        ref: (input.ref || "").toUpperCase(),
        note: input.note || "",
        userId: actor.id,
      },
    });
    await audit(tx, {
      userId: actor.id,
      userName: actor.name,
      action: "Payment",
      ref: c.name,
      details: `Received KES ${amount} by ${input.method}`,
    });
    return rec;
  });
}

export type PurchaseLineInput = { productId: number; qty: number; cost: number };

export async function createPurchase(
  actor: { id: number; name: string },
  input: {
    supplierId: number;
    invoice?: string;
    date?: string;
    dueDate?: string;
    items: PurchaseLineInput[];
    paid: number;
    method: PayMethod;
    ref?: string;
  },
  settings: { allowNegative: boolean; updateCost: boolean }
) {
  if (!input.items?.length) throw new AppError("Add at least one product");
  return prisma.$transaction(async (tx) => {
    const sup = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!sup) throw new AppError("Choose a supplier");

    const products = await tx.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    let total = 0;
    const lines: { productId: number; qty: number; cost: number; total: number }[] = [];
    for (const it of input.items) {
      const p = byId.get(it.productId);
      if (!p) throw new AppError("Unknown product");
      const qty = num(it.qty);
      const cost = num(it.cost);
      if (!(qty > 0)) throw new AppError(`Enter a quantity for ${p.name}`);
      if (cost < 0) throw new AppError("Buying price cannot be negative");
      lines.push({ productId: p.id, qty, cost, total: r2(qty * cost) });
      total += qty * cost;
    }
    total = r2(total);
    const paid = r2(num(input.paid));
    if (paid < 0 || paid > total + 0.005) throw new AppError("Amount paid must be between 0 and the total cost");

    const seq = await nextSeq(tx, "purchase");
    const no = "PUR-" + pad6(seq);
    const purchase = await tx.purchase.create({
      data: {
        no,
        supplierId: sup.id,
        invoice: input.invoice || "",
        date: input.date ? new Date(input.date + "T09:00:00Z") : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate + "T12:00:00Z") : null,
        total,
        userId: actor.id,
        items: { create: lines },
      },
    });

    for (const l of lines) {
      const p = byId.get(l.productId)!;
      await moveStock(tx, {
        productId: p.id,
        delta: l.qty,
        type: "purchase",
        reason: `${no}${input.invoice ? " / inv " + input.invoice : ""} from ${sup.name}`,
        ref: no,
        userId: actor.id,
        allowNegative: true,
      });
      if (settings.updateCost && Math.abs(p.buyPrice - l.cost) > 0.004) {
        await tx.priceLog.create({
          data: { productId: p.id, field: "buy", oldValue: p.buyPrice, newValue: l.cost, why: "Purchase " + no, userId: actor.id },
        });
        await tx.product.update({ where: { id: p.id }, data: { buyPrice: l.cost } });
      }
    }
    if (paid > 0) {
      await tx.supplierPayment.create({
        data: {
          supplierId: sup.id,
          purchaseId: purchase.id,
          amount: paid,
          method: input.method,
          ref: input.ref || "",
          userId: actor.id,
          note: "Paid on purchase",
        },
      });
    }
    await audit(tx, {
      userId: actor.id,
      userName: actor.name,
      action: "Purchase",
      ref: no,
      details: `${sup.name}: KES ${total}, paid KES ${paid}`,
    });
    return purchase;
  });
}

export async function supplierBalance(tx: TX, supplierId: number): Promise<number> {
  const pur = await tx.purchase.aggregate({ where: { supplierId }, _sum: { total: true } });
  const pay = await tx.supplierPayment.aggregate({ where: { supplierId }, _sum: { amount: true } });
  const ret = await tx.return.aggregate({ where: { type: "supplier", supplierId }, _sum: { total: true } });
  return r2((pur._sum.total ?? 0) - (pay._sum.amount ?? 0) - (ret._sum.total ?? 0));
}

export async function paySupplier(
  actor: { id: number; name: string },
  input: { supplierId: number; amount: number; method: PayMethod; ref?: string; note?: string }
) {
  return prisma.$transaction(async (tx) => {
    const sup = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!sup) throw new AppError("Choose a supplier");
    const amount = r2(num(input.amount));
    if (!(amount > 0)) throw new AppError("Enter the amount paid");
    const bal = await supplierBalance(tx, sup.id);
    if (amount > bal + 0.005) throw new AppError(`That is more than the balance owed (KES ${bal})`);

    let left = amount;
    const purchases = await tx.purchase.findMany({ where: { supplierId: sup.id }, orderBy: { createdAt: "asc" } });
    for (const pu of purchases) {
      if (left <= 0.004) break;
      const paidSoFar = await tx.supplierPayment.aggregate({ where: { purchaseId: pu.id }, _sum: { amount: true } });
      const owed = r2(pu.total - (paidSoFar._sum.amount ?? 0));
      if (owed <= 0.004) continue;
      const use = Math.min(owed, left);
      left = r2(left - use);
      await tx.supplierPayment.create({
        data: { supplierId: sup.id, purchaseId: pu.id, amount: use, method: input.method, ref: input.ref || "", userId: actor.id, note: input.note || "" },
      });
    }
    if (left > 0.004) {
      await tx.supplierPayment.create({
        data: { supplierId: sup.id, purchaseId: null, amount: left, method: input.method, ref: input.ref || "", userId: actor.id, note: input.note || "" },
      });
    }
    await audit(tx, { userId: actor.id, userName: actor.name, action: "Payment", ref: sup.name, details: `Paid supplier KES ${amount} by ${input.method}` });
  });
}

export async function createCustomerReturn(
  actor: { id: number; name: string; role: string },
  input: { saleId: number; lines: { itemId: number; qty: number }[]; refundMode: "cash" | "mpesa" | "store_credit"; reason: string; cancel?: boolean }
) {
  if (!String(input.reason ?? "").trim()) throw new AppError("Enter the reason for the return");
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: input.saleId }, include: { items: true } });
    if (!sale) throw new AppError("Sale not found");
    const ratio = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;

    let total = 0;
    let cost = 0;
    const lines: { productId: number; name: string; qty: number; factor: number; amount: number; cost: number; itemId: number }[] = [];
    for (const l of input.lines) {
      const item = sale.items.find((i) => i.id === l.itemId);
      const q = num(l.qty);
      if (!item || !(q > 0)) continue;
      if (q > item.qty - item.retQty + 1e-9) {
        throw new AppError(`You can only return ${r2(item.qty - item.retQty)} of ${item.name}`);
      }
      const amount = r2(q * (item.total / item.qty) * ratio);
      const c = r2((item.costTotal / item.qty) * q);
      lines.push({ productId: item.productId, name: item.name, qty: q, factor: item.factor, amount, cost: c, itemId: item.id });
      total += amount;
      cost += c;
    }
    if (!lines.length) throw new AppError("Choose at least one item to return");
    total = r2(total);
    cost = r2(cost);

    const creditLeft = r2(sale.creditAmount - sale.creditReduced);
    const creditReduce = sale.customerId ? Math.min(total, Math.max(creditLeft, 0)) : 0;
    const rest = r2(total - creditReduce);
    let refundCash = 0;
    let storeCredit = 0;
    if (rest > 0) {
      if (input.refundMode === "store_credit") {
        if (!sale.customerId) throw new AppError("Store credit needs a customer on the sale");
        storeCredit = rest;
      } else {
        refundCash = rest;
      }
    }

    const seq = await nextSeq(tx, "return");
    const no = "RET-" + pad6(seq);
    for (const l of lines) {
      await tx.saleItem.update({ where: { id: l.itemId }, data: { retQty: { increment: l.qty } } });
      await moveStock(tx, {
        productId: l.productId,
        delta: l.qty * l.factor,
        type: "return_",
        reason: `${no} (sale ${sale.no}): ${input.reason}`,
        ref: no,
        userId: actor.id,
        allowNegative: true,
      });
    }
    const newCreditReduced = r2(sale.creditReduced + creditReduce);
    const freshItems = await tx.saleItem.findMany({ where: { saleId: sale.id } });
    const allReturned = freshItems.every((i) => Math.abs(i.qty - i.retQty) < 1e-9);
    await tx.sale.update({
      where: { id: sale.id },
      data: {
        creditReduced: newCreditReduced,
        status: allReturned ? (input.cancel ? "cancelled" : "returned") : "part_returned",
      },
    });
    const ret = await tx.return.create({
      data: {
        no,
        type: "customer",
        saleId: sale.id,
        customerId: sale.customerId,
        total,
        cost,
        creditReduced: creditReduce,
        refundCash,
        storeCredit,
        reason: input.reason,
        userId: actor.id,
        items: { create: lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, amount: l.amount, cost: l.cost })) },
      },
    });
    await audit(tx, {
      userId: actor.id,
      userName: actor.name,
      action: input.cancel ? "Sale cancellation" : "Refund",
      ref: sale.no,
      details: `${no}: KES ${total} (${input.reason})`,
    });
    return ret;
  });
}

export async function adjustStock(
  actor: { id: number; name: string },
  input: { productId: number; mode: "add" | "remove" | "set"; qty: number; type: MoveType; reason: string },
  settings: { allowNegative: boolean }
) {
  if (!String(input.reason ?? "").trim()) throw new AppError("A reason is required for every stock change");
  return prisma.$transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { id: input.productId } });
    if (!p) throw new AppError("Choose a product");
    const qty = num(input.qty);
    if (input.mode !== "set" && !(qty > 0)) throw new AppError("Enter a quantity above zero");
    if (input.mode === "set" && qty < 0) throw new AppError("Counted quantity cannot be negative");
    const delta = input.mode === "add" ? qty : input.mode === "remove" ? -qty : r2(qty - p.stock);
    if (delta === 0) throw new AppError("No change - the count already matches");
    await moveStock(tx, {
      productId: p.id,
      delta,
      type: input.type,
      reason: input.reason,
      userId: actor.id,
      allowNegative: settings.allowNegative,
    });
    await audit(tx, {
      userId: actor.id,
      userName: actor.name,
      action: "Stock adjustment",
      ref: p.name,
      details: `${input.type}: ${delta > 0 ? "+" : ""}${delta} (${input.reason})`,
    });
  });
}
