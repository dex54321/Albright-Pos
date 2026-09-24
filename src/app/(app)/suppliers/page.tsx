"use client";
import { useEffect, useState } from "react";
import { api, fmtN, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";

type Supplier = { id: number; name: string; company: string; phone: string; location: string; balance: number };

export default function SuppliersPage() {
  const [list, setList] = useState<Supplier[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [payFor, setPayFor] = useState<Supplier | null>(null);

  function refresh() {
    api<Supplier[]>("/api/suppliers").then(setList);
  }
  useEffect(refresh, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Suppliers</h1>
        <button className="btn btn-pri" onClick={() => setAddOpen(true)}>
          + Add supplier
        </button>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Phone</th>
              <th>Location</th>
              <th className="n">Outstanding</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.company}</div>
                </td>
                <td>{s.phone}</td>
                <td>{s.location}</td>
                <td className={`n ${s.balance > 0 ? "font-bold text-rose-600" : ""}`}>{fmtN(s.balance)}</td>
                <td className="n">
                  <button className="btn btn-pri" disabled={s.balance <= 0} onClick={() => setPayFor(s)}>
                    Pay
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  No suppliers yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {addOpen && (
        <AddSupplier
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            refresh();
          }}
        />
      )}
      {payFor && (
        <PaySupplier
          supplier={payFor}
          onClose={() => setPayFor(null)}
          onSaved={() => {
            setPayFor(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AddSupplier({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", company: "", phone: "", location: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/suppliers", { method: "POST", body: JSON.stringify(f) });
      onSaved();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add supplier" onClose={onClose}>
      <div className="space-y-2">
        <div>
          <label className="label">Supplier name *</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Company</label>
          <input className="input" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        </div>
      </div>
      {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-pri" disabled={busy} onClick={save}>
          Save
        </button>
      </div>
    </Modal>
  );
}

function PaySupplier({ supplier, onClose, onSaved }: { supplier: Supplier; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(supplier.balance));
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/suppliers/${supplier.id}/pay`, { method: "POST", body: JSON.stringify({ amount: Number(amount) || 0, method, ref }) });
      onSaved();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={"Pay " + supplier.name} onClose={onClose}>
      <div className="space-y-2">
        <div>
          <label className="label">Amount (owed {fmtN(supplier.balance)})</label>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Bank</option>
          </select>
        </div>
        <div>
          <label className="label">Reference / M-Pesa code</label>
          <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
      </div>
      {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-pri" disabled={busy} onClick={save}>
          Record payment
        </button>
      </div>
    </Modal>
  );
}
