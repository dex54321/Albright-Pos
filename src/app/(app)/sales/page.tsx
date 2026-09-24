"use client";
import { useEffect, useState } from "react";
import { api, fmtN, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";

type Sale = {
  id: number;
  no: string;
  total: number;
  status: string;
  createdAt: string;
  user: { name: string };
  customer: { name: string } | null;
  items: { id: number; name: string; qty: number; retQty: number }[];
  payments: { method: string }[];
  creditAmount: number;
};

export default function SalesPage() {
  const [list, setList] = useState<Sale[]>([]);
  const [q, setQ] = useState("");
  const [retSale, setRetSale] = useState<Sale | null>(null);

  function refresh() {
    api<Sale[]>("/api/sales" + (q ? "?q=" + encodeURIComponent(q) : "")).then(setList);
  }
  useEffect(refresh, [q]);

  function methods(s: Sale) {
    const ms = [...new Set(s.payments.map((p) => p.method))];
    if (s.creditAmount > 0) ms.push("credit");
    return ms.join(" + ") || "-";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Sales &amp; Returns</h1>
        <input className="input w-56" placeholder="Receipt no. or customer" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date</th>
              <th>Cashier</th>
              <th>Customer</th>
              <th>Paid by</th>
              <th className="n">Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.no}</td>
                <td>{new Date(s.createdAt).toLocaleString()}</td>
                <td>{s.user.name}</td>
                <td>{s.customer?.name ?? "Walk-in"}</td>
                <td className="capitalize">{methods(s)}</td>
                <td className="n">{fmtN(s.total)}</td>
                <td>
                  <span className={`badge ${s.status === "completed" ? "badge-g" : s.status === "part_returned" ? "badge-a" : "badge-r"}`}>
                    {s.status.replace("_", " ")}
                  </span>
                </td>
                <td className="n">
                  {(s.status === "completed" || s.status === "part_returned") && (
                    <button className="btn" onClick={() => setRetSale(s)}>
                      Return
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  No sales
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {retSale && (
        <ReturnModal
          sale={retSale}
          onClose={() => setRetSale(null)}
          onDone={() => {
            setRetSale(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ReturnModal({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<"cash" | "mpesa" | "store_credit">("cash");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const lines = Object.entries(qty)
      .map(([id, v]) => ({ itemId: Number(id), qty: Number(v) || 0 }))
      .filter((l) => l.qty > 0);
    if (!lines.length) {
      setErr("Enter a quantity to return");
      return;
    }
    if (!reason.trim()) {
      setErr("Enter the reason for the return");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api("/api/returns", { method: "POST", body: JSON.stringify({ saleId: sale.id, lines, refundMode: mode, reason }) });
      onDone();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={"Return items - " + sale.no} onClose={onClose}>
      <table className="tbl w-full">
        <thead>
          <tr>
            <th>Item</th>
            <th className="n">Sold</th>
            <th className="n">Returnable</th>
            <th className="n">Return qty</th>
          </tr>
        </thead>
        <tbody>
          {sale.items
            .filter((i) => i.qty - i.retQty > 0)
            .map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td className="n">{i.qty}</td>
                <td className="n">{i.qty - i.retQty}</td>
                <td className="n">
                  <input
                    className="w-20 rounded border border-slate-300 px-1 text-right"
                    value={qty[i.id] ?? ""}
                    onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label">Refund as</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="cash">Cash refund</option>
            <option value="mpesa">M-Pesa refund</option>
            {sale.customer && <option value="store_credit">Store credit</option>}
          </select>
        </div>
        <div>
          <label className="label">Reason *</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Close
        </button>
        <button className="btn btn-pri" disabled={busy} onClick={submit}>
          Record return
        </button>
      </div>
    </Modal>
  );
}
