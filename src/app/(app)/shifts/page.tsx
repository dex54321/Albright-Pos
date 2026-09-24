"use client";
import { useEffect, useState } from "react";
import { api, fmt, fmtN, ApiError } from "@/lib/client";

type Figures = { cashSales: number; mpesa: number; card: number; credit: number; count: number; expected: number };
type Shift = { id: number; user: { name: string }; openedAt: string; closedAt: string | null; openCash: number; expected: number | null; counted: number | null; variance: number | null };

export default function ShiftsPage() {
  const [open, setOpen] = useState<Shift | null>(null);
  const [figures, setFigures] = useState<Figures | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [openCash, setOpenCash] = useState("0");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [closedResult, setClosedResult] = useState<Shift | null>(null);

  function refresh() {
    api<{ open: Shift | null; figures: Figures | null; history: Shift[] }>("/api/shifts").then((d) => {
      setOpen(d.open);
      setFigures(d.figures);
      setHistory(d.history);
    });
  }
  useEffect(refresh, []);

  async function doOpen() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/shifts", { method: "POST", body: JSON.stringify({ openCash: Number(openCash) || 0 }) });
      refresh();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  async function doClose() {
    if (counted === "") {
      setErr("Count the cash and enter the amount");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await api<Shift>("/api/shifts/close", { method: "POST", body: JSON.stringify({ counted: Number(counted) || 0, notes }) });
      setClosedResult(r);
      setCounted("");
      setNotes("");
      refresh();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Cashier Shifts</h1>
      {!open && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Start your shift</h2>
          <label className="label">Opening cash in the drawer (KES)</label>
          <input className="input mb-3 max-w-xs" value={openCash} onChange={(e) => setOpenCash(e.target.value)} />
          <button className="btn btn-pri py-3" disabled={busy} onClick={doOpen}>
            Open shift
          </button>
        </div>
      )}
      {open && figures && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Shift open since {new Date(open.openedAt).toLocaleString()}</h2>
          <table className="tbl mb-3 w-full max-w-md">
            <tbody>
              <tr>
                <td>Opening cash</td>
                <td className="n">{fmtN(open.openCash)}</td>
              </tr>
              <tr>
                <td>+ Cash sales</td>
                <td className="n">{fmtN(figures.cashSales)}</td>
              </tr>
              <tr className="font-bold">
                <td>= Expected cash</td>
                <td className="n">{fmtN(figures.expected)}</td>
              </tr>
            </tbody>
          </table>
          <div className="mb-3 text-sm text-slate-500">
            Also this shift: {figures.count} sale(s) | M-Pesa {fmt(figures.mpesa)} | Card {fmt(figures.card)} | Credit {fmt(figures.credit)}
          </div>
          <div className="grid max-w-md gap-2 sm:grid-cols-2">
            <div>
              <label className="label">Actual cash counted (KES)</label>
              <input className="input" value={counted} onChange={(e) => setCounted(e.target.value)} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {err && <div className="mt-2 text-sm text-rose-600">{err}</div>}
          <button className="btn btn-dark mt-3 py-3" disabled={busy} onClick={doClose}>
            Close shift
          </button>
        </div>
      )}
      {closedResult && (
        <div className="card text-center">
          <div className="text-slate-500">
            Expected {fmt(closedResult.expected ?? 0)} | Counted {fmt(closedResult.counted ?? 0)}
          </div>
          <div className={`my-2 text-2xl font-extrabold ${(closedResult.variance ?? 0) < -0.005 ? "text-rose-600" : (closedResult.variance ?? 0) > 0.005 ? "text-amber-600" : "text-emerald-600"}`}>
            {(closedResult.variance ?? 0) < -0.005
              ? `Shortage of ${fmt(-(closedResult.variance ?? 0))}`
              : (closedResult.variance ?? 0) > 0.005
              ? `Excess of ${fmt(closedResult.variance ?? 0)}`
              : "Exact balance"}
          </div>
          <button className="btn" onClick={() => setClosedResult(null)}>
            OK
          </button>
        </div>
      )}
      <h2 className="text-lg font-bold">Shift history</h2>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Cashier</th>
              <th>Opened</th>
              <th>Closed</th>
              <th className="n">Opening</th>
              <th className="n">Expected</th>
              <th className="n">Counted</th>
              <th className="n">Variance</th>
            </tr>
          </thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id}>
                <td>{s.user.name}</td>
                <td>{new Date(s.openedAt).toLocaleString()}</td>
                <td>{s.closedAt ? new Date(s.closedAt).toLocaleString() : <span className="badge badge-g">open</span>}</td>
                <td className="n">{fmtN(s.openCash)}</td>
                <td className="n">{s.expected != null ? fmtN(s.expected) : "-"}</td>
                <td className="n">{s.counted != null ? fmtN(s.counted) : "-"}</td>
                <td className="n">{s.variance != null ? fmtN(s.variance) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
