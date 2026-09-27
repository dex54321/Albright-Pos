"use client";
import { useEffect, useState } from "react";
import { api, fmt, fmtN, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";

type Customer = { id: number; name: string; phone: string; balance: number; creditLimit: number };

export default function DebtorsPage() {
  const [list, setList] = useState<Customer[]>([]);
  const [payFor, setPayFor] = useState<Customer | null>(null);

  function refresh() {
    api<Customer[]>("/api/customers").then((cs) => setList(cs.filter((c) => c.balance > 0.005).sort((a, b) => b.balance - a.balance)));
  }
  useEffect(refresh, []);

  const total = list.reduce((a, c) => a + c.balance, 0);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Credit / Debtors</h1>
      <div className="card" style={{ background: "var(--steel)", color: "#fff" }}>
        <div className="text-xs text-slate-300">Total owed by customers</div>
        <div className="text-3xl font-extrabold">{fmt(total)}</div>
        <div className="text-xs text-slate-300">{list.length} customer(s) with balances</div>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th className="n">Credit limit</th>
              <th className="n">Outstanding</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td className="font-semibold">{c.name}</td>
                <td>{c.phone}</td>
                <td className="n">{c.creditLimit ? fmtN(c.creditLimit) : "-"}</td>
                <td className="n font-bold text-rose-600">{fmtN(c.balance)}</td>
                <td className="n">
                  <button className="btn btn-pri" onClick={() => setPayFor(c)}>
                    Receive payment
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  No customers currently owe anything
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {payFor && (
        <PayModal
          customer={payFor}
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

function PayModal({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(customer.balance));
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/customers/${customer.id}/pay`, { method: "POST", body: JSON.stringify({ amount: Number(amount) || 0, method, ref }) });
      onSaved();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={"Payment from " + customer.name} onClose={onClose}>
      <div className="space-y-2">
        <div>
          <label className="label">Amount received (owes {fmtN(customer.balance)})</label>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="card">Card</option>
            <option value="bank">Bank</option>
          </select>
        </div>
        <div>
          <label className="label">M-Pesa code / reference</label>
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
