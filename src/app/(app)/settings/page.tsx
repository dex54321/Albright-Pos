"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/client";

type Settings = {
  shopName: string;
  address: string;
  phone: string;
  email: string;
  taxPin: string;
  footer: string;
  allowNegative: boolean;
  vatEnabled: boolean;
  vatRate: number;
  creditDays: number;
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "admin";
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api<Settings>("/api/settings").then(setS);
  }, []);

  async function save() {
    if (!s) return;
    setErr("");
    setMsg("");
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify(s) });
      setMsg("Settings saved");
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }

  if (!s) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <div className="card space-y-2">
        <h2 className="font-semibold">Shop &amp; receipt</h2>
        <div>
          <label className="label">Shop name</label>
          <input className="input" value={s.shopName} onChange={(e) => setS({ ...s, shopName: e.target.value })} disabled={!isAdmin} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} disabled={!isAdmin} />
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} disabled={!isAdmin} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} disabled={!isAdmin} />
        </div>
        <div>
          <label className="label">KRA PIN / VAT number</label>
          <input className="input" value={s.taxPin} onChange={(e) => setS({ ...s, taxPin: e.target.value })} disabled={!isAdmin} />
        </div>
        <div>
          <label className="label">Receipt thank-you message</label>
          <input className="input" value={s.footer} onChange={(e) => setS({ ...s, footer: e.target.value })} disabled={!isAdmin} />
        </div>
      </div>

      {isAdmin && (
        <div className="card space-y-2">
          <h2 className="font-semibold">Sales rules</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.allowNegative} onChange={(e) => setS({ ...s, allowNegative: e.target.checked })} />
            Allow selling more than the stock on record (negative stock)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.vatEnabled} onChange={(e) => setS({ ...s, vatEnabled: e.target.checked })} />
            Show VAT on receipts
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">VAT rate %</label>
              <input className="input" value={s.vatRate} onChange={(e) => setS({ ...s, vatRate: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">Default credit period (days)</label>
              <input className="input" value={s.creditDays} onChange={(e) => setS({ ...s, creditDays: Number(e.target.value) || 14 })} />
            </div>
          </div>
        </div>
      )}

      {msg && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}
      {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
      {isAdmin && (
        <button className="btn btn-pri" onClick={save}>
          Save settings
        </button>
      )}
    </div>
  );
}
