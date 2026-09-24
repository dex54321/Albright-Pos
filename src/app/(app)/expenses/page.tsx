"use client";
import { useEffect, useState } from "react";
import { api, fmt, fmtN, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";

const CATS = ["Transport", "Electricity", "Rent", "Salaries", "Repairs", "Airtime", "Packaging", "Other"];
type Expense = { id: number; category: string; amount: number; date: string; method: string; description: string; user: { name: string } };

export default function ExpensesPage() {
  const [list, setList] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);

  function refresh() {
    api<Expense[]>("/api/expenses").then(setList);
  }
  useEffect(refresh, []);
  const total = list.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Expenses</h1>
        <button className="btn btn-pri" onClick={() => setOpen(true)}>
          + Record expense
        </button>
      </div>
      <div className="card">
        <div className="text-xs text-slate-500">Total expenses</div>
        <div className="text-2xl font-extrabold">{fmt(total)}</div>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Paid by</th>
              <th>Recorded by</th>
              <th className="n">Amount</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.date).toLocaleDateString()}</td>
                <td>{e.category}</td>
                <td>{e.description}</td>
                <td className="capitalize">{e.method}</td>
                <td>{e.user.name}</td>
                <td className="n">{fmtN(e.amount)}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No expenses recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {open && (
        <NewExpense
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

function NewExpense({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ category: CATS[0], amount: "", date: new Date().toISOString().slice(0, 10), method: "cash", description: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/expenses", { method: "POST", body: JSON.stringify({ ...f, amount: Number(f.amount) || 0 }) });
      onSaved();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Record expense" onClose={onClose}>
      <div className="space-y-2">
        <div>
          <label className="label">Category</label>
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Amount (KES) *</label>
          <input className="input" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
        <div>
          <label className="label">Payment method</label>
          <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Bank</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
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
