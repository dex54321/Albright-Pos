"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import { parseCSV, normalizeUnit, parsePrice, downloadText } from "@/lib/csv";
import Modal from "@/components/Modal";

type ExistingProduct = { id: number; name: string };

type Row = {
  name: string;
  category: string;
  unit: string;
  buy: string;
  sell: string;
  qty: string;
  supplier: string;
  occurrences: number;
  state: "new" | "dup" | "error";
  error?: string;
  dupId?: number;
  action: "create" | "update" | "skip";
};

// [field key, label, header-matching pattern]
const FIELDS: [string, string, RegExp][] = [
  ["name", "Product name", /name|item|product|desc/i],
  ["category", "Category", /categ/i],
  ["unit", "Unit", /unit|uom/i],
  ["qty", "Quantity", /qty|quant|stock|count/i],
  ["buy", "Buying price", /buy|cost|purchase/i],
  ["sell", "Selling price", /\bsell/i],
  ["supplier", "Supplier", /suppl?ier|vendor|dealer/i],
  ["sku", "SKU", /sku|^code$|^id$/i],
  ["barcode", "Barcode", /barcode|ean|upc/i],
];

export default function ImportWizard({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pasted, setPasted] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [useQty, setUseQty] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  async function handleFile(f: File) {
    setPasted(await f.text());
  }

  function goToMap() {
    const text = pasted;
    if (!text.trim()) {
      setErr("Choose a CSV file or paste your rows first");
      return;
    }
    const all = parseCSV(text);
    if (all.length < 2) {
      setErr("The file needs a heading row and at least one product row");
      return;
    }
    const h = all[0].map((x) => x.trim());
    const used = new Set<number>();
    const m: Record<string, number> = {};
    for (const [key, , re] of FIELDS) {
      const i = h.findIndex((cell, ix) => !used.has(ix) && re.test(cell));
      if (i >= 0) {
        m[key] = i;
        used.add(i);
      }
    }
    setHeader(h);
    setDataRows(all.slice(1));
    setMap(m);
    setErr("");
    setStep(2);
  }

  async function buildPreview(currentMap: Record<string, number>) {
    setBusy(true);
    setErr("");
    try {
      if (currentMap.name == null || currentMap.sell == null) {
        setErr("Please match at least Product name and Selling price");
        setBusy(false);
        return;
      }
      const existing = await api<ExistingProduct[]>("/api/products?limit=100000&active=0");
      const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p.id]));

      const get = (r: string[], key: string) => (currentMap[key] != null ? String(r[currentMap[key]] ?? "").trim() : "");
      const byKey = new Map<string, Row>();
      for (const r of dataRows) {
        const name = get(r, "name");
        if (!name) continue; // skip blank/section rows silently
        const key = name.toLowerCase();
        const buyRaw = get(r, "buy");
        const sellRaw = get(r, "sell");
        const buyN = parsePrice(buyRaw);
        const sellN = parsePrice(sellRaw);
        const qtyN = parsePrice(get(r, "qty"));
        const prev = byKey.get(key);
        const row: Row = {
          name,
          category: get(r, "category"),
          unit: normalizeUnit(get(r, "unit") || "Piece"),
          buy: buyN != null ? String(buyN) : buyRaw ? "0" : "0",
          sell: sellN != null ? String(sellN) : "",
          qty: qtyN != null ? String(qtyN) : "0",
          supplier: get(r, "supplier"),
          occurrences: (prev?.occurrences ?? 0) + 1,
          state: "new",
          action: "create",
        };
        byKey.set(key, row); // later occurrence overwrites earlier - "latest price wins"
      }
      const list = [...byKey.values()];
      for (const row of list) {
        const dupId = byName.get(row.name.toLowerCase());
        if (!(Number(row.sell) > 0)) {
          row.state = "error";
          row.error = "Selling price missing or not a number";
          row.action = "skip";
        } else if (dupId) {
          row.state = "dup";
          row.dupId = dupId;
          row.action = "update";
        } else {
          row.state = "new";
          row.action = "create";
        }
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      setRows(list);
      setStep(3);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, ix) => (ix === i ? { ...r, ...patch } : r)));
  }

  async function runImport() {
    setBusy(true);
    setErr("");
    try {
      const items = rows
        .filter((r) => r.action !== "skip")
        .map((r) => ({
          name: r.name,
          category: r.category,
          unit: r.unit,
          supplier: r.supplier,
          buy: Number(r.buy) || 0,
          sell: Number(r.sell) || 0,
          stock: useQty ? Number(r.qty) || 0 : 0,
          action: r.action,
          dupId: r.dupId,
        }));
      if (!items.length) {
        setErr("Nothing selected to import");
        setBusy(false);
        return;
      }
      const res = await api<{ created: number; updated: number; skipped: number }>("/api/products/import", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      setResult(res);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const toImport = rows.filter((r) => r.action !== "skip").length;

  if (result) {
    return (
      <Modal title="Import complete" onClose={onImported}>
        <p>
          <b>{result.created}</b> new product{result.created === 1 ? "" : "s"} added, <b>{result.updated}</b> updated
          {result.skipped ? `, ${result.skipped} skipped` : ""}.
        </p>
        <div className="mt-4 flex justify-end">
          <button className="btn btn-pri" onClick={onImported}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Import products" onClose={onClose}>
      {step === 1 && (
        <div className="space-y-3">
          <p className="mt-0 text-sm text-slate-600">
            <b>Step 1 of 3 - Upload.</b> Choose a CSV file, or paste rows copied from Excel. In Excel use{" "}
            <i>Save As &gt; CSV</i>. The first row must be column headings.
          </p>
          <div>
            <label className="label">CSV file</label>
            <input type="file" accept=".csv,.txt,.tsv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          <div>
            <label className="label">Or paste here</label>
            <textarea className="input" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Product name,Category,Unit,Quantity,Buying price,Selling price,Supplier" />
          </div>
          <button
            className="btn btn-sm"
            onClick={() => downloadText("product-import-template.csv", "Product name,Category,Unit,Quantity,Buying price,Selling price,Supplier\r\nCement 50kg,Building Materials,Bag,0,880,900,\r\n")}
          >
            Download a blank template
          </button>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-pri" onClick={goToMap}>
              Next: match columns
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="mt-0 text-sm text-slate-600">
            <b>Step 2 of 3 - Match your columns</b> to the shop&apos;s fields. Found {dataRows.length} data row(s).
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(([key, label]) => (
              <div key={key}>
                <label className="label">
                  {label}
                  {key === "name" || key === "sell" ? " *" : ""}
                </label>
                <select
                  className="input"
                  value={map[key] ?? -1}
                  onChange={(e) => setMap({ ...map, [key]: Number(e.target.value) })}
                >
                  <option value={-1}>- not in my file -</option>
                  {header.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn btn-pri" disabled={busy} onClick={() => buildPreview(map)}>
              Next: preview
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="mt-0 text-sm text-slate-600">
            <b>Step 3 of 3 - Check and correct.</b> {rows.length} distinct product(s) found (repeats in your file were
            combined, using the last price seen for each):{" "}
            <span className="font-semibold text-emerald-700">{rows.filter((r) => r.state === "new").length} new</span>,{" "}
            <span className="font-semibold text-amber-700">{rows.filter((r) => r.state === "dup").length} already in your products</span>,{" "}
            <span className="font-semibold text-rose-700">{rows.filter((r) => r.state === "error").length} need a price fixed</span>.
          </p>
          <label className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
            <input type="checkbox" className="mt-1" checked={useQty} onChange={(e) => setUseQty(e.target.checked)} />
            <span>
              Also set opening stock from the quantity column. <b>Only tick this if your file is a fresh delivery you haven&apos;t sold from yet</b> - a
              purchase history like a year&apos;s ledger will make stock levels wrong, since it doesn&apos;t know what has already sold. Leave unticked
              and count your real stock instead.
            </span>
          </label>
          <div className="max-h-[45vh] overflow-auto rounded-md border border-slate-200">
            <table className="tbl w-full">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th className="n">Qty</th>
                  <th className="n">Buying</th>
                  <th className="n">Selling</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge ${r.state === "new" ? "badge-g" : r.state === "dup" ? "badge-a" : "badge-r"}`}>
                        {r.state === "new" ? "New" : r.state === "dup" ? "Existing" : r.error}
                      </span>
                      {r.occurrences > 1 && <div className="text-[11px] text-slate-400">seen {r.occurrences}x</div>}
                    </td>
                    <td>
                      <input className="w-40 rounded border border-slate-300 px-1 py-0.5" value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
                    </td>
                    <td>
                      <input className="w-28 rounded border border-slate-300 px-1 py-0.5" value={r.category} onChange={(e) => updateRow(i, { category: e.target.value })} />
                    </td>
                    <td>
                      <input className="w-20 rounded border border-slate-300 px-1 py-0.5" value={r.unit} onChange={(e) => updateRow(i, { unit: e.target.value })} />
                    </td>
                    <td className="n">
                      <input className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right" value={r.qty} onChange={(e) => updateRow(i, { qty: e.target.value })} />
                    </td>
                    <td className="n">
                      <input className="w-20 rounded border border-slate-300 px-1 py-0.5 text-right" value={r.buy} onChange={(e) => updateRow(i, { buy: e.target.value })} />
                    </td>
                    <td className="n">
                      <input
                        className="w-20 rounded border border-slate-300 px-1 py-0.5 text-right"
                        value={r.sell}
                        onChange={(e) => updateRow(i, { sell: e.target.value, state: Number(e.target.value) > 0 ? (r.dupId ? "dup" : "new") : "error" })}
                      />
                    </td>
                    <td>
                      <select className="input" style={{ minHeight: 32 }} value={r.action} onChange={(e) => updateRow(i, { action: e.target.value as Row["action"] })}>
                        <option value="create">Add as new</option>
                        {r.dupId && <option value="update">Update existing</option>}
                        <option value="skip">Skip</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setStep(2)}>
              Back
            </button>
            <button className="btn btn-pri" disabled={busy || !toImport} onClick={runImport}>
              {busy ? "Importing..." : `Import ${toImport} product${toImport === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
