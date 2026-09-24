"use client";
import { useEffect, useState } from "react";
import { api, fmtN } from "@/lib/client";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type Report = { rows: Record<string, string | number>[]; summary: Record<string, string | number> };

export default function ReportsPage() {
  const [type, setType] = useState<"sales" | "profit" | "inventory">("sales");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [data, setData] = useState<Report | null>(null);

  useEffect(() => {
    api<Report>(`/api/reports?type=${type}&from=${from}&to=${to}`).then(setData);
  }, [type, from, to]);

  function exportCsv() {
    if (!data || !data.rows.length) return;
    const cols = Object.keys(data.rows[0]);
    const csv = [cols.join(","), ...data.rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${type}-report-${today()}.csv`;
    a.click();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Reports</h1>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="sales">Sales</option>
          <option value="profit">Profit &amp; loss</option>
          <option value="inventory">Inventory</option>
        </select>
        {type !== "inventory" && (
          <>
            <input className="input w-auto" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className="input w-auto" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
        <button className="btn" onClick={exportCsv}>
          Export CSV
        </button>
        <button className="btn" onClick={() => window.print()}>
          Print
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(data.summary).map(([k, v]) => (
              <div className="card" key={k}>
                <div className="text-xs capitalize text-slate-500">{k}</div>
                <div className="text-xl font-extrabold">{typeof v === "number" ? fmtN(v) : v}</div>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {data.rows[0] &&
                    Object.keys(data.rows[0]).map((k) => (
                      <th key={k} className="capitalize">
                        {k}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, 500).map((r, i) => (
                  <tr key={i}>
                    {Object.entries(r).map(([k, v]) => (
                      <td key={k} className={typeof v === "number" ? "n" : ""}>
                        {typeof v === "number" ? fmtN(v) : k === "date" ? new Date(v).toLocaleString() : v}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td className="p-6 text-center text-slate-400">No data in this range</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
