"use client";
import { useEffect, useState } from "react";
import { api, fmt, fmtN, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";

type Supplier = { id: number; name: string };
type Product = { id: number; name: string; buyPrice: number };
type Purchase = {
  id: number;
  no: string;
  invoice: string;
  date: string;
  total: number;
  supplier: Supplier;
  payments: { amount: number }[];
};

export default function PurchasesPage() {
  const [list, setList] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);

  function refresh() {
    api<Purchase[]>("/api/purchases").then(setList);
  }
  useEffect(refresh, []);
  useEffect(() => {
    api<Supplier[]>("/api/suppliers").then(setSuppliers);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Purchases</h1>
        <button className="btn btn-pri" onClick={() => setOpen(true)}>
          + New purchase
        </button>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref</th>
              <th>Supplier</th>
              <th>Invoice</th>
              <th className="n">Total</th>
              <th className="n">Paid</th>
              <th className="n">Balance</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const paid = p.payments.reduce((a, x) => a + x.amount, 0);
              const bal = p.total - paid;
              return (
                <tr key={p.id}>
                  <td>{new Date(p.date).toLocaleDateString()}</td>
                  <td>{p.no}</td>
                  <td>{p.supplier.name}</td>
                  <td>{p.invoice}</td>
                  <td className="n">{fmtN(p.total)}</td>
                  <td className="n">{fmtN(paid)}</td>
                  <td className="n">
                    <span className={`badge ${bal <= 0.005 ? "badge-g" : paid > 0 ? "badge-a" : "badge-r"}`}>{fmtN(bal)}</span>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  No purchases yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {open && (
        <NewPurchase
          suppliers={suppliers}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function NewPurchase({ suppliers, onClose, onSaved }: { suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const [supplierId, setSupplierId] = useState<number | "">(suppliers[0]?.id ?? "");
  const [invoice, setInvoice] = useState("");
  const [rows, setRows] = useState<{ pid: number; name: string; qty: number; cost: number }[]>([]);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Product[]>([]);
  const [paid, setPaid] = useState("0");
  const [method, setMethod] = useState("cash");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setOptions([]);
      return;
    }
    const t = setTimeout(() => {
      api<Product[]>("/api/products?q=" + encodeURIComponent(q) + "&limit=8").then(setOptions);
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const total = rows.reduce((a, r) => a + r.qty * r.cost, 0);

  async function save() {
    if (!supplierId) {
      setErr("Choose a supplier");
      return;
    }
    if (!rows.length) {
      setErr("Add at least one product");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api("/api/purchases", {
        method: "POST",
        body: JSON.stringify({ supplierId, invoice, items: rows.map((r) => ({ productId: r.pid, qty: r.qty, cost: r.cost })), paid: Number(paid) || 0, method }),
      });
      onSaved();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New purchase" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Supplier *</label>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Invoice / reference no.</label>
          <input className="input" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
        </div>
      </div>
      <div className="relative mt-3">
        <label className="label">Add product</label>
        <input className="input" placeholder="Search product" value={q} onChange={(e) => setQ(e.target.value)} />
        {options.length > 0 && (
          <div className="absolute z-10 max-h-52 w-full overflow-auto rounded-md border border-slate-300 bg-white shadow-lg">
            {options.map((p) => (
              <div
                key={p.id}
                className="cursor-pointer border-b px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  setRows((r) => (r.some((x) => x.pid === p.id) ? r : [...r, { pid: p.id, name: p.name, qty: 1, cost: p.buyPrice }]));
                  setQ("");
                  setOptions([]);
                }}
              >
                {p.name} <span className="text-xs text-slate-400">was {fmtN(p.buyPrice)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 max-h-52 overflow-auto">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-sm">
            <span className="flex-1">{r.name}</span>
            <input
              className="w-16 rounded border border-slate-300 px-1 text-right"
              value={r.qty}
              onChange={(e) => setRows(rows.map((x, idx) => (idx === i ? { ...x, qty: Number(e.target.value) || 0 } : x)))}
            />
            <input
              className="w-20 rounded border border-slate-300 px-1 text-right"
              value={r.cost}
              onChange={(e) => setRows(rows.map((x, idx) => (idx === i ? { ...x, cost: Number(e.target.value) || 0 } : x)))}
            />
            <span className="w-20 text-right tabular-nums">{fmtN(r.qty * r.cost)}</span>
            <button className="text-rose-600" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
              x
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-bold">
        <span>Total cost</span>
        <span>{fmt(total)}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className="label">Amount paid now</label>
          <input className="input" value={paid} onChange={(e) => setPaid(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Bank</option>
          </select>
        </div>
      </div>
      {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-pri" disabled={busy} onClick={save}>
          Save purchase &amp; add stock
        </button>
      </div>
    </Modal>
  );
}
