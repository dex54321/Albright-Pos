"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, fmt, fmtN } from "@/lib/client";

type Dash = {
  today: { count: number; revenue: number; profit: number; cash: number; mpesa: number; card: number; credit: number };
  stockCost: number;
  stockRetail: number;
  lowStock: number;
  outOfStock: number;
  recentSales: { id: number; no: string; total: number; createdAt: string; customer?: { name: string } | null }[];
  recentPurchases: { id: number; no: string; total: number; date: string; supplier: { name: string } }[];
  days: { l: string; v: number }[];
};

function Kpi({ label, value, big, tone, href }: { label: string; value: string; big?: boolean; tone?: string; href?: string }) {
  const box = (
    <div
      className={`card ${big && !href ? "col-span-2" : ""}`}
      style={big ? { background: "var(--steel)", color: "#fff" } : undefined}
    >
      <div className={`text-xs ${big ? "text-slate-300" : "text-slate-500"}`}>{label}</div>
      <div className={`mt-1 font-extrabold tabular-nums ${big ? "text-3xl" : "text-xl"} ${tone ?? ""}`}>{value}</div>
      {href && <div className={`mt-1 text-xs underline ${big ? "text-amber-300" : "text-blue-600"}`}>See which items sold</div>}
    </div>
  );
  return href ? (
    <Link href={href} className={big ? "col-span-2 block" : "block"}>
      {box}
    </Link>
  ) : (
    box
  );
}

function Bars({ days }: { days: { l: string; v: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.v));
  return (
    <div className="flex h-40 items-end gap-1">
      {days.map((d) => (
        <div key={d.l} className="flex flex-1 flex-col items-center gap-1" title={`${d.l}: ${fmt(d.v)}`}>
          <div className="w-full rounded-t bg-amber-400" style={{ height: `${Math.max(2, (d.v / max) * 140)}px` }} />
          <div className="text-[9px] text-slate-500">{d.l}</div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<Dash>("/api/dashboard").then(setD).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="rounded-md bg-rose-50 p-4 text-rose-700">{err}</div>;
  if (!d) return <div className="text-slate-500">Loading...</div>;

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi big label="Today's sales" value={fmt(d.today.revenue)} href={`/reports?type=items&from=${todayIso}&to=${todayIso}`} />
        <Kpi label="Today's profit" value={fmt(d.today.profit)} tone={d.today.profit < 0 ? "text-rose-600" : "text-emerald-600"} />
        <Kpi label="Transactions today" value={String(d.today.count)} />
        <Kpi label="Cash sales" value={fmt(d.today.cash)} />
        <Kpi label="M-Pesa sales" value={fmt(d.today.mpesa)} />
        <Kpi label="Credit sales" value={fmt(d.today.credit)} />
        <Kpi label="Stock value (cost)" value={fmt(d.stockCost)} />
        <Kpi label="Low / out of stock" value={`${d.lowStock} / ${d.outOfStock}`} tone={d.outOfStock ? "text-rose-600" : ""} />
      </div>

      {(d.lowStock > 0 || d.outOfStock > 0) && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {d.outOfStock > 0 && <span>{d.outOfStock} product(s) out of stock. </span>}
          {d.lowStock > 0 && <span>{d.lowStock} product(s) running low. </span>}
          <Link href="/products" className="underline">
            Review products
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-semibold">Sales by day (last 14 days)</h2>
          <Bars days={d.days} />
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">Recent transactions</h2>
          <div className="space-y-1 text-sm">
            {d.recentSales.length === 0 && <div className="text-slate-400">No sales yet</div>}
            {d.recentSales.map((s) => (
              <div key={s.id} className="flex justify-between border-b border-slate-100 py-1">
                <span>
                  {s.no} <span className="text-slate-400">{s.customer?.name ?? "Walk-in"}</span>
                </span>
                <span className="tabular-nums">{fmtN(s.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">Recent purchases</h2>
        <div className="space-y-1 text-sm">
          {d.recentPurchases.length === 0 && <div className="text-slate-400">No purchases yet</div>}
          {d.recentPurchases.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-slate-100 py-1">
              <span>
                {p.no} <span className="text-slate-400">{p.supplier.name}</span>
              </span>
              <span className="tabular-nums">{fmtN(p.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
