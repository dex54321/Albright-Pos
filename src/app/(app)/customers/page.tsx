"use client";
import { useEffect, useState } from "react";
import { api, fmtN, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";

type Customer = { id: number; name: string; phone: string; location: string; type: string; creditLimit: number; balance: number };

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Customer[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [payFor, setPayFor] = useState<Customer | null>(null);

  function refresh() {
    api<Customer[]>("/api/customers" + (q ? "?q=" + encodeURIComponent(q) : "")).then(setList);
  }
  useEffect(refresh, [q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Customers</h1>
        <input className="input w-56" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-pri" onClick={() => setAddOpen(true)}>
          + Add customer
        </button>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Type</th>
              <th>Phone</th>
              <th className="n">Credit limit</th>
              <th className="n">Balance owed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td className="font-semibold">{c.name}</td>
                <td className="capitalize">{c.type}</td>
                <td>{c.phone}</td>
                <td className="n">{c.creditLimit ? fmtN(c.creditLimit) : "-"}</td>
                <td className={`n ${c.balance > 0 ? "font-bold text-rose-600" : ""}`}>{fmtN(c.balance)}</td>
                <td className="n">
                  <button className="btn btn-pri" disabled={c.balance <= 0} onClick={() => setPayFor(c)}>
                    Receive payment
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No customers
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {addOpen && (
        <AddCustomer
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            refresh();
          }}
        />
      )}
      {payFor && (
        <ReceivePayment
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

function AddCustomer({ onClose, onSaved }: { onClose: () => void; onSaved: (c: Customer) => void }) {
  const [f, setF] = useState({ name: "", phone: "", location: "", type: "regular", creditLimit: "0" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setErr("");
    try {
      const c = await api<Customer>("/api/customers", { method: "POST", body: JSON.stringify({ ...f, creditLimit: Number(f.creditLimit) || 0 }) });
      onSaved(c);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add customer" onClose={onClose}>
      <div className="space-y-2">
        <div>
          <label className="label">Customer name *</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0712 345 678" />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="walkin">Walk-in</option>
            <option value="contractor">Contractor</option>
            <option value="builder">Builder</option>
            <option value="company">Company</option>
            <option value="regular">Regular customer</option>
          </select>
        </div>
        <div>
          <label className="label">Credit limit (KES, 0 = none)</label>
          <input className="input" value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: e.target.value })} />
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

function ReceivePayment({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: () => void }) {
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
