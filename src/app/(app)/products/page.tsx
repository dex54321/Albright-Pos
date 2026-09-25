"use client";
import { useEffect, useState } from "react";
import { api, fmtN, ApiError } from "@/lib/client";
import Modal from "@/components/Modal";
import ImportWizard from "@/components/ImportWizard";

type Unit = { id: number; name: string };
type Category = { id: number; name: string; parentId: number | null };
type Supplier = { id: number; name: string };
type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  buyPrice: number;
  sellPrice: number;
  minSell: number;
  stock: number;
  minStock: number;
  active: boolean;
  unit: Unit;
  category: Category | null;
};

/**
 * Deletes a product outright if it has no sales/purchase history yet;
 * otherwise the server deactivates it instead (kept for old receipts and
 * reports) and it disappears from the active list here after refresh().
 */
async function deleteProduct(p: Product, refresh: () => void) {
  if (!confirm(`Remove "${p.name}"? If it has sales or purchase history, it will be marked inactive instead of deleted.`)) return;
  try {
    const res = await api<{ result: "deleted" | "deactivated" }>(`/api/products/${p.id}`, { method: "DELETE" });
    alert(res.result === "deleted" ? "Product deleted." : "This product has history, so it was deactivated instead of deleted.");
    refresh();
  } catch (e) {
    alert((e as ApiError).message);
  }
}

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState<"" | "in" | "low" | "out">("");
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [importing, setImporting] = useState(false);

  function refresh() {
    const params = new URLSearchParams({ limit: "5000", active: "0" });
    if (q) params.set("q", q);
    api<Product[]>("/api/products?" + params.toString()).then(setProducts);
  }
  useEffect(refresh, [q]);
  useEffect(() => {
    api<Unit[]>("/api/units").then(setUnits);
    api<Category[]>("/api/categories").then(setCats);
    api<Supplier[]>("/api/suppliers").then(setSuppliers);
  }, []);

  const shown = products.filter((p) => {
    if (stockFilter === "out") return p.stock <= 0;
    if (stockFilter === "low") return p.stock > 0 && p.stock <= p.minStock;
    if (stockFilter === "in") return p.stock > p.minStock;
    return true;
  });
  const lowCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const outCount = products.filter((p) => p.stock <= 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Products</h1>
        <input className="input w-56" placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={stockFilter} onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}>
          <option value="">All stock ({products.length})</option>
          <option value="in">In stock</option>
          <option value="low">Low stock ({lowCount})</option>
          <option value="out">Out of stock ({outCount})</option>
        </select>
        <button className="btn" onClick={() => setImporting(true)}>
          Import CSV
        </button>
        <button className="btn btn-pri" onClick={() => setEditing("new")}>
          + Add product
        </button>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Unit</th>
              <th className="n">Stock</th>
              <th className="n">Buying</th>
              <th className="n">Selling</th>
              <th className="n">Margin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const profit = p.sellPrice - p.buyPrice;
              const margin = p.sellPrice ? (profit / p.sellPrice) * 100 : 0;
              const low = p.stock > 0 && p.stock <= p.minStock;
              const out = p.stock <= 0;
              return (
                <tr key={p.id}>
                  <td>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-400">
                      {p.sku}
                      {!p.active ? " | inactive" : ""}
                    </div>
                  </td>
                  <td>{p.category?.name ?? ""}</td>
                  <td>{p.unit.name}</td>
                  <td className="n">
                    {p.stock} <span className={`badge ${out ? "badge-r" : low ? "badge-a" : "badge-g"}`}>{out ? "Out" : low ? "Low" : "OK"}</span>
                  </td>
                  <td className="n">{fmtN(p.buyPrice)}</td>
                  <td className="n">{fmtN(p.sellPrice)}</td>
                  <td className={`n ${profit < 0 ? "text-rose-600" : ""}`}>{margin.toFixed(1)}%</td>
                  <td className="n" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn" onClick={() => setEditing(p)}>
                      Edit
                    </button>{" "}
                    <button className="btn" onClick={() => deleteProduct(p, refresh)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  No products
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          units={units}
          cats={cats}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {importing && (
        <ImportWizard
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ProductForm({
  product,
  units,
  cats,
  suppliers,
  onClose,
  onSaved,
}: {
  product: Product | null;
  units: Unit[];
  cats: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: product?.name ?? "",
    categoryId: product?.category?.id ?? (cats.find((c) => !c.parentId)?.id ?? ""),
    unitId: product?.unit.id ?? units[0]?.id ?? "",
    supplierId: "" as number | "",
    buyPrice: product?.buyPrice ?? 0,
    sellPrice: product?.sellPrice ?? 0,
    minSell: product?.minSell ?? 0,
    stock: product?.stock ?? 0,
    minStock: product?.minStock ?? 5,
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    active: product?.active ?? true,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setErr("");
    try {
      if (product) {
        await api(`/api/products/${product.id}`, { method: "PUT", body: JSON.stringify(f) });
      } else {
        await api("/api/products", { method: "POST", body: JSON.stringify(f) });
      }
      onSaved();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const margin = f.sellPrice ? (((f.sellPrice - f.buyPrice) / f.sellPrice) * 100).toFixed(1) : "0";

  return (
    <Modal title={product ? "Edit product" : "Add product"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="label">Product name *</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: Number(e.target.value) })}>
            {cats
              .filter((c) => !c.parentId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label">Unit</label>
          <select className="input" value={f.unitId} onChange={(e) => setF({ ...f, unitId: Number(e.target.value) })}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: Number(e.target.value) })}>
            <option value="">- none -</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div />
        <div>
          <label className="label">Buying price (KES) *</label>
          <input className="input" value={f.buyPrice} onChange={(e) => setF({ ...f, buyPrice: Number(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="label">Selling price (KES) * <span className="text-slate-400">margin {margin}%</span></label>
          <input className="input" value={f.sellPrice} onChange={(e) => setF({ ...f, sellPrice: Number(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="label">Minimum selling price</label>
          <input className="input" value={f.minSell} onChange={(e) => setF({ ...f, minSell: Number(e.target.value) || 0 })} />
        </div>
        {!product && (
          <div>
            <label className="label">Opening stock</label>
            <input className="input" value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) || 0 })} />
          </div>
        )}
        <div>
          <label className="label">Minimum stock level</label>
          <input className="input" value={f.minStock} onChange={(e) => setF({ ...f, minStock: Number(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="label">SKU</label>
          <input className="input" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} placeholder="Auto if empty" />
        </div>
        <div>
          <label className="label">Barcode</label>
          <input className="input" value={f.barcode ?? ""} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          Active (can be sold)
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
