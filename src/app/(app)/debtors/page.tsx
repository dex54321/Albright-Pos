"use client";
import { useEffect, useState } from "react";
import { api, fmt, fmtN, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";

type Customer = { id: number; name: string; phone: string; balance: number; creditLimit: number };

export default function DebtorsPage() {
  const [list, setList] = useState<Customer[]>([]);
  const [payFor, setPayFor] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);

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
                <td className="n" style={{ whiteSpace: "nowrap" }}>
                  <button className="btn" onClick={() => setViewing(c)}>
                    View items
                  </button>{" "}
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
      {viewing && <CreditItemsModal customer={viewing} onClose={() => setViewing(null)} />}
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

type CreditSale = {
  id: number;
  no: string;
  date: string;
  dueDate: string | null;
  creditAmount: number;
  creditReduced: number;
  balance: number;
  items: { name: string; unit: string; qty: number; price: number; total: number }[];
};

function CreditItemsModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [sales, setSales] = useState<CreditSale[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<CreditSale[]>(`/api/customers/${customer.id}/credit-sales`)
      .then(setSales)
      .catch((e) => setErr((e as ApiError).message));
  }, [customer.id]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal title={"Items on credit - " + customer.name} onClose={onClose}>
      {err && <div className="text-sm text-rose-600">{err}</div>}
      {!sales && !err && <div className="text-sm text-slate-400">Loading...</div>}
      {sales && sales.length === 0 && <div className="text-sm text-slate-400">No credit sales recorded for this customer.</div>}
      {sales && sales.length > 0 && (
        <div className="max-h-[60vh] space-y-4 overflow-auto">
          {sales.map((s) => {
            const overdue = s.balance > 0.005 && s.dueDate && s.dueDate.slice(0, 10) < today;
            return (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <b>{s.no}</b> <span className="text-slate-400">{new Date(s.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={overdue ? "font-semibold text-rose-600" : "text-slate-500"}>
                      Due {s.dueDate ? new Date(s.dueDate).toLocaleDateString() : "-"}
                      {overdue ? " (overdue)" : ""}
                    </span>
                    <span className={`badge ${s.balance <= 0.005 ? "badge-g" : "badge-r"}`}>
                      {s.balance <= 0.005 ? "Paid off" : fmtN(s.balance) + " owed"}
                    </span>
                  </div>
                </div>
                <table className="tbl w-full">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="n">Qty</th>
                      <th className="n">Price</th>
                      <th className="n">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map((it, i) => (
                      <tr key={i}>
                        <td>{it.name}</td>
                        <td className="n">
                          {it.qty} {it.unit}
                        </td>
                        <td className="n">{fmtN(it.price)}</td>
                        <td className="n">{fmtN(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-1 text-right text-sm text-slate-500">Taken on credit: {fmt(s.creditAmount)}</div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
