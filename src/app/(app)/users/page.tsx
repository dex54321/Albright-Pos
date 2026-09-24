"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";

type User = { id: number; name: string; username: string; role: string; active: boolean };

export default function UsersPage() {
  const [list, setList] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | "new" | null>(null);

  function refresh() {
    api<User[]>("/api/users").then(setList);
  }
  useEffect(refresh, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Users</h1>
        <button className="btn btn-pri" onClick={() => setEditing("new")}>
          + Add user
        </button>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.name}</td>
                <td>{u.username}</td>
                <td>
                  <span className={`badge ${u.role === "admin" ? "badge-a" : u.role === "manager" ? "badge-a" : "badge-k"}`}>{u.role}</span>
                </td>
                <td>
                  <span className={`badge ${u.active ? "badge-g" : "badge-r"}`}>{u.active ? "Active" : "Disabled"}</span>
                </td>
                <td className="n">
                  <button className="btn" onClick={() => setEditing(u)}>
                    Edit / reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card text-sm text-slate-500">
        <b className="text-slate-700">What each role can do.</b> Admin: everything. Manager: sales, purchases,
        inventory, reports, customers, suppliers and shop settings. Cashier: POS, customers, receipts and their own
        sales history; cannot see buying prices, add products, or manage users.
      </div>
      {editing && (
        <UserForm
          user={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function UserForm({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: user?.name ?? "", username: user?.username ?? "", role: user?.role ?? "cashier", active: user?.active ?? true, password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setErr("");
    try {
      if (user) await api(`/api/users/${user.id}`, { method: "PUT", body: JSON.stringify(f) });
      else await api("/api/users", { method: "POST", body: JSON.stringify(f) });
      onSaved();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={user ? "Edit user" : "Add user"} onClose={onClose}>
      <div className="space-y-2">
        <div>
          <label className="label">Full name *</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Username *</label>
          <input className="input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} disabled={!!user} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="label">{user ? "New password (leave blank to keep)" : "Password (min 6 characters) *"}</label>
          <input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          Account active
        </label>
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
