"use client";
import { useEffect, useRef, useState } from "react";
import { api, fmt, fmtN, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";
import { PAYBILL, PAYBILL_ACCOUNT } from "@/lib/paybill";
import { useCart, type CartLine, type CartCustomer } from "@/lib/cartStore";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryIcons";

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  sellPrice: number;
  minSell: number;
  stock: number;
  unit: { name: string };
  category: { id: number; name: string } | null;
};
type Category = { id: number; name: string; parentId: number | null };
type Customer = CartCustomer;

export default function PosPage() {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [catId, setCatId] = useState<number | "">("");
  const { cart, setCart, discount, setDiscount, customer, setCustomer, clearSale } = useCart();
  const [showPay, setShowPay] = useState(false);
  const [receipt, setReceipt] = useState<{ id: number; no: string; total: number } | null>(null);
  const [err, setErr] = useState("");
  const searchBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Category[]>("/api/categories").then((c) => setCats(c.filter((x) => !x.parentId)));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ limit: "90" });
      if (q) params.set("q", q);
      api<Product[]>("/api/products?" + params.toString())
        .then((list) => setProducts(catId ? list.filter((p) => p.category?.id === catId) : list))
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [q, catId]);

  const subtotal = cart.reduce((a, l) => a + l.qty * l.price - l.disc, 0);
  const disc = Math.min(discount, subtotal);
  const total = Math.round((subtotal - disc) * 100) / 100;

  function addProduct(p: Product) {
    setErr("");
    const inCart = cart.find((l) => l.pid === p.id);
    const already = inCart ? inCart.qty : 0;
    if (already + 1 > p.stock) {
      setErr(p.stock <= 0 ? `${p.name} is out of stock` : `Only ${p.stock} ${p.unit.name} of ${p.name} in stock`);
      return;
    }
    if (inCart) {
      setCart(cart.map((l) => (l.pid === p.id ? { ...l, qty: l.qty + 1 } : l)));
    } else {
      setCart([...cart, { pid: p.id, name: p.name, unit: p.unit.name, qty: 1, price: p.sellPrice, list: p.sellPrice, disc: 0, stock: p.stock, minSell: p.minSell }]);
    }
  }
  function setQty(i: number, v: number) {
    if (v <= 0) {
      setCart(cart.filter((_, idx) => idx !== i));
      return;
    }
    const l = cart[i];
    if (v > l.stock) {
      setErr(`Only ${l.stock} ${l.unit} of ${l.name} in stock`);
      return;
    }
    setErr("");
    setCart(cart.map((line, idx) => (idx === i ? { ...line, qty: v } : line)));
  }
  function setPrice(i: number, v: number) {
    setCart(cart.map((line, idx) => (idx === i ? { ...line, price: v } : line)));
  }
  function removeLine(i: number) {
    setCart(cart.filter((_, idx) => idx !== i));
  }
  function onSearchEnter() {
    const term = q.trim().toLowerCase();
    if (!term) return;
    const exact = products.find((p) => p.barcode === term || p.sku.toLowerCase() === term);
    const match = exact || (products.length === 1 ? products[0] : null);
    if (match) {
      addProduct(match);
      setQ("");
    } else {
      setErr(products.length ? "Several products match - tap the one you want" : `No product found for "${q}"`);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0">
        <input
          ref={searchBox}
          className="input mb-2"
          placeholder="Search name, SKU, barcode... (Enter to add)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearchEnter()}
        />
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          <button className={`btn shrink-0 ${!catId ? "btn-dark" : ""}`} onClick={() => setCatId("")}>
            All
          </button>
          {cats.map((c) => (
            <button key={c.id} className={`btn shrink-0 ${catId === c.id ? "btn-dark" : ""}`} onClick={() => setCatId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        {err && <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {products.map((p) => {
            const Icon = getCategoryIcon(p.category?.name);
            return (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              disabled={p.stock <= 0}
              className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left disabled:opacity-50"
            >
              <div className="flex h-14 items-center justify-center" style={{ background: getCategoryColor(p.category?.name) }}>
                <Icon size={26} strokeWidth={1.75} className="text-slate-700/70" />
              </div>
              <div className="flex-1 px-2 pt-1 text-sm font-semibold leading-tight">{p.name}</div>
              <div className="px-2 text-base font-extrabold">{fmtN(p.sellPrice)}</div>
              <div className={`px-2 pb-2 text-xs ${p.stock <= 0 ? "text-rose-600" : p.stock <= 5 ? "text-amber-600" : "text-slate-500"}`}>
                {p.stock <= 0 ? "Out of stock" : `${p.stock} ${p.unit.name}`}
              </div>
            </button>
            );
          })}
          {products.length === 0 && <div className="col-span-full py-10 text-center text-slate-400">No products match.</div>}
        </div>
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 rounded-t-xl bg-[var(--steel)] px-3 py-2 text-white">
          <b className="flex-1">Current sale</b>
          <CustomerPicker customer={customer} onPick={setCustomer} />
        </div>
        <div className="max-h-[42vh] overflow-auto">
          {cart.length === 0 && <div className="p-8 text-center text-sm text-slate-400">Tap a product to start the sale.</div>}
          {cart.map((l, i) => (
            <div key={i} className="border-b border-slate-100 p-2.5">
              <div className="flex justify-between font-semibold">
                <span>{l.name}</span>
                <span>{fmtN(l.qty * l.price - l.disc)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <div className="inline-flex">
                  <button className="h-8 w-8 border border-slate-300 bg-slate-100 font-bold" onClick={() => setQty(i, l.qty - 1)}>
                    -
                  </button>
                  <input
                    className="h-8 w-16 border-y border-slate-300 text-center"
                    key={l.pid + "-" + l.qty}
                    defaultValue={l.qty}
                    inputMode="decimal"
                    onBlur={(e) => setQty(i, Number(e.target.value) || 0)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                  <button className="h-8 w-8 border border-slate-300 bg-slate-100 font-bold" onClick={() => setQty(i, l.qty + 1)}>
                    +
                  </button>
                </div>
                <span className="text-slate-400">{l.unit}</span>
                <input
                  className="w-20 rounded border border-slate-300 px-1 text-right"
                  value={l.price}
                  onChange={(e) => setPrice(i, Number(e.target.value) || 0)}
                  title="Price"
                />
                {l.minSell > 0 && l.price < l.minSell - 0.005 && <span className="text-xs font-semibold text-rose-600">below min</span>}
                <button className="text-xs text-rose-600 underline" onClick={() => removeLine(i)}>
                  remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{fmtN(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">
              Discount{" "}
              <button className="text-xs text-blue-600 underline" onClick={() => setDiscount(Number(prompt("Discount amount (KES)", String(discount)) || 0))}>
                edit
              </button>
            </span>
            <span>-{fmtN(disc)}</span>
          </div>
          <div className="flex justify-between text-2xl font-extrabold">
            <span>Total</span>
            <span>{fmtN(total)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3 pt-0">
          <button className="btn btn-pri col-span-3 py-3" disabled={!cart.length} onClick={() => setShowPay(true)}>
            Take payment
          </button>
          <button
            className="btn col-span-3"
            onClick={() => {
              clearSale();
            }}
          >
            Clear sale
          </button>
        </div>
      </aside>

      {showPay && (
        <PayModal
          total={total}
          discount={disc}
          cart={cart}
          customer={customer}
          onClose={() => setShowPay(false)}
          onDone={(sale) => {
            setShowPay(false);
            clearSale();
            setReceipt(sale);
          }}
        />
      )}
      {receipt && <ReceiptModal id={receipt.id} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function CustomerPicker({ customer, onPick }: { customer: Customer | null; onPick: (c: Customer | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [list, setList] = useState<Customer[]>([]);
  useEffect(() => {
    if (!open) return;
    api<Customer[]>("/api/customers" + (q ? "?q=" + encodeURIComponent(q) : "")).then(setList);
  }, [open, q]);
  return (
    <div className="relative">
      <button className="btn text-xs" onClick={() => setOpen((o) => !o)}>
        {customer ? customer.name : "Walk-in customer"}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-md border border-slate-300 bg-white text-slate-900 shadow-lg">
          <input autoFocus className="input rounded-b-none" placeholder="Search customer" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-56 overflow-auto">
            <div
              className="cursor-pointer border-b px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
            >
              Walk-in customer
            </div>
            {list.map((c) => (
              <div
                key={c.id}
                className="cursor-pointer border-b px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate-400">
                  {c.phone} | owes {fmtN(c.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PayModal({
  total,
  discount,
  cart,
  customer,
  onClose,
  onDone,
}: {
  total: number;
  discount: number;
  cart: CartLine[];
  customer: Customer | null;
  onClose: () => void;
  onDone: (s: { id: number; no: string; total: number }) => void;
}) {
  const [mode, setMode] = useState<"cash" | "mpesa" | "card" | "credit" | "mixed">("cash");
  const [cash, setCash] = useState(String(total));
  const [mpesa, setMpesa] = useState("0");
  const [mpesaRef, setMpesaRef] = useState("");
  const [card, setCard] = useState("0");
  const [credit, setCredit] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needApproval, setNeedApproval] = useState(false);
  const [apUser, setApUser] = useState("");
  const [apPass, setApPass] = useState("");

  function switchMode(m: typeof mode) {
    setMode(m);
    setCash(m === "cash" ? String(total) : "0");
    setMpesa(m === "mpesa" ? String(total) : "0");
    setCard(m === "card" ? String(total) : "0");
    setCredit(m === "credit" ? String(total) : "0");
  }

  const cashN = Number(cash) || 0;
  const mpN = mode === "mpesa" ? total : mode === "mixed" ? Number(mpesa) || 0 : 0;
  const cdN = mode === "card" ? total : mode === "mixed" ? Number(card) || 0 : 0;
  const crN = mode === "credit" || mode === "mixed" ? Number(credit) || 0 : 0;
  const cashDue = Math.round((total - mpN - cdN - crN) * 100) / 100;
  const change = cashDue > 0.005 ? Math.round((cashN - cashDue) * 100) / 100 : 0;
  const short = cashDue > 0.005 && cashN < cashDue - 0.005;

  async function submit(approvedBy?: number) {
    setErr("");
    setBusy(true);
    try {
      const sale = await api<{ id: number; no: string; total: number }>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((l) => ({ productId: l.pid, qty: l.qty, price: l.price, listPrice: l.list, disc: l.disc, unit: l.unit, factor: 1 })),
          discount,
          customerId: customer?.id ?? null,
          cash: mode === "mpesa" ? 0 : mode === "card" ? 0 : cashN,
          mpesa: mpN,
          mpesaRef,
          card: cdN,
          credit: crN,
          approvedBy,
        }),
      });
      onDone(sale);
    } catch (e) {
      const err = e as ApiError;
      if (err.needApproval) setNeedApproval(true);
      else setErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setErr("");
    setBusy(true);
    try {
      const r = await api<{ id: number; role: string }>("/api/auth/check-approver", {
        method: "POST",
        body: JSON.stringify({ username: apUser, password: apPass }),
      });
      await submit(r.id);
    } catch {
      setErr("Those manager details are not valid");
    } finally {
      setBusy(false);
    }
  }

  if (needApproval) {
    return (
      <Modal title="Manager approval needed" onClose={onClose}>
        <p>Some items are below minimum price, or this exceeds the customer&apos;s credit limit.</p>
        <div className="mt-3 space-y-2">
          <div>
            <label className="label">Manager username</label>
            <input className="input" value={apUser} onChange={(e) => setApUser(e.target.value)} />
          </div>
          <div>
            <label className="label">Manager password</label>
            <input className="input" type="password" value={apPass} onChange={(e) => setApPass(e.target.value)} />
          </div>
        </div>
        {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-pri" onClick={approve} disabled={busy}>
            Approve
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Take payment" onClose={onClose}>
      <div className="mb-3 flex justify-between">
        <span className="text-slate-500">Amount due</span>
        <b className="text-3xl tabular-nums">{fmt(total)}</b>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {(["cash", "mpesa", "card", "credit", "mixed"] as const).map((m) => (
          <button key={m} className={`btn ${mode === m ? "btn-dark" : ""}`} onClick={() => switchMode(m)}>
            {m === "mpesa" ? "M-Pesa" : m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      {(mode === "cash" || mode === "mixed" || mode === "credit") && (
        <div className="mb-2">
          <label className="label">{mode === "credit" ? "Deposit paid now in cash (optional)" : "Cash received"}</label>
          <input className="input" value={cash} onChange={(e) => setCash(e.target.value)} inputMode="decimal" />
        </div>
      )}
      {(mode === "mixed") && (
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="label">M-Pesa amount</label>
            <input className="input" value={mpesa} onChange={(e) => setMpesa(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="label">Card amount</label>
            <input className="input" value={card} onChange={(e) => setCard(e.target.value)} inputMode="decimal" />
          </div>
        </div>
      )}
      {(mode === "mpesa" || (mode === "mixed" && mpN > 0)) && (
        <div className="mb-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
          <div className="mb-1 font-semibold text-emerald-900">Ask the customer to pay by M-Pesa:</div>
          <div className="text-emerald-900">M-Pesa &gt; Lipa na M-Pesa &gt; Paybill</div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-white p-2">
              <div className="text-[11px] text-slate-500">Business no.</div>
              <div className="text-xl font-extrabold tabular-nums">{PAYBILL}</div>
            </div>
            <div className="rounded bg-white p-2">
              <div className="text-[11px] text-slate-500">Account no.</div>
              <div className="text-xl font-extrabold tabular-nums">{PAYBILL_ACCOUNT}</div>
            </div>
            <div className="rounded bg-white p-2">
              <div className="text-[11px] text-slate-500">Amount</div>
              <div className="text-xl font-extrabold tabular-nums">{fmtN(mpN)}</div>
            </div>
          </div>
          <div className="mt-1 text-xs text-emerald-800">Then type the M-Pesa code from their confirmation message below.</div>
        </div>
      )}
      {(mode === "mpesa" || mode === "mixed") && (mode === "mpesa" || mpN > 0 || mode === "mixed") && (
        <div className="mb-2">
          <label className="label">M-Pesa transaction code</label>
          <input className="input" value={mpesaRef} onChange={(e) => setMpesaRef(e.target.value.toUpperCase())} placeholder="e.g. SGH7XY12AB" />
        </div>
      )}
      {(mode === "credit" || mode === "mixed") && (
        <div className="mb-2">
          <label className="label">Amount on credit</label>
          <input className="input" value={credit} onChange={(e) => setCredit(e.target.value)} inputMode="decimal" />
          {!customer && <div className="mt-1 text-xs text-rose-600">Choose a customer from the cart panel first.</div>}
          {customer && (
            <div className="mt-1 text-xs text-slate-500">
              {customer.name} owes {fmt(customer.balance)} now.
            </div>
          )}
        </div>
      )}
      <div className="card mt-2 text-sm">
        {cashDue > 0.005 && <div className="flex justify-between">Cash to collect<b>{fmt(Math.max(0, cashDue))}</b></div>}
        {mpN > 0 && <div className="flex justify-between">M-Pesa<b>{fmt(mpN)}</b></div>}
        {cdN > 0 && <div className="flex justify-between">Card<b>{fmt(cdN)}</b></div>}
        {crN > 0 && <div className="flex justify-between">On credit<b>{fmt(crN)}</b></div>}
        {!short && change > 0 && (
          <div className="flex justify-between text-lg">
            Change to give<b className="text-emerald-600">{fmt(change)}</b>
          </div>
        )}
        {short && <div className="font-semibold text-rose-600">Cash is short by {fmt(cashDue - cashN)}</div>}
      </div>
      {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-pri text-base"
          disabled={busy || short || (mpN > 0 && !mpesaRef.trim()) || (crN > 0 && !customer)}
          onClick={() => submit()}
        >
          Complete sale
        </button>
      </div>
    </Modal>
  );
}

function ReceiptModal({ id, onClose }: { id: number; onClose: () => void }) {
  type Sale = {
    no: string;
    createdAt: string;
    total: number;
    subtotal: number;
    discount: number;
    items: { name: string; qty: number; price: number; total: number; unit: string }[];
    payments: { method: string; amount: number; ref: string }[];
    customer: { name: string } | null;
    change: number;
    cashReceived: number;
    creditAmount: number;
  };
  const [sale, setSale] = useState<Sale | null>(null);
  useEffect(() => {
    api<Sale>("/api/sales/" + id).then(setSale);
  }, [id]);
  return (
    <Modal title={sale ? "Receipt " + sale.no : "Receipt"} onClose={onClose}>
      {!sale ? (
        <div>Loading...</div>
      ) : (
        <div className="mx-auto max-w-xs font-mono text-xs">
          <div className="text-center text-sm font-bold">Albright Hardware Enterprice</div>
          <div className="text-center text-slate-500">{new Date(sale.createdAt).toLocaleString()}</div>
          <hr className="my-2 border-dashed" />
          {sale.items.map((it, i) => (
            <div key={i} className="mb-1">
              <div>{it.name}</div>
              <div className="flex justify-between">
                <span>
                  {it.qty} {it.unit} x {fmtN(it.price)}
                </span>
                <span>{fmtN(it.total)}</span>
              </div>
            </div>
          ))}
          <hr className="my-2 border-dashed" />
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span>{fmt(sale.total)}</span>
          </div>
          {sale.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {p.method}
                {p.ref ? ` (${p.ref})` : ""}
              </span>
              <span>{fmtN(p.amount)}</span>
            </div>
          ))}
          {sale.creditAmount > 0 && (
            <div className="flex justify-between">
              <span>On credit</span>
              <span>{fmtN(sale.creditAmount)}</span>
            </div>
          )}
          {sale.change > 0 && (
            <div className="flex justify-between">
              <span>Change</span>
              <span>{fmtN(sale.change)}</span>
            </div>
          )}
          <hr className="my-2 border-dashed" />
          {sale.creditAmount > 0 && (
            <div className="mb-1 text-center">
              Pay by M-Pesa Paybill {PAYBILL}, Acc {PAYBILL_ACCOUNT}
            </div>
          )}
          <div className="text-center">Thank you for shopping with us!</div>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={() => window.print()}>
          Print
        </button>
        <button className="btn btn-pri" onClick={onClose}>
          New sale
        </button>
      </div>
    </Modal>
  );
}
