"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

const NAV: [string, string, string[]][] = [
  ["/dashboard", "Dashboard", ["admin", "manager", "cashier"]],
  ["/pos", "POS", ["admin", "manager", "cashier"]],
  ["/sales", "Sales & Returns", ["admin", "manager", "cashier"]],
  ["/products", "Products", ["admin", "manager"]],
  ["/purchases", "Purchases", ["admin", "manager"]],
  ["/suppliers", "Suppliers", ["admin", "manager"]],
  ["/customers", "Customers", ["admin", "manager", "cashier"]],
  ["/debtors", "Credit / Debtors", ["admin", "manager", "cashier"]],
  ["/expenses", "Expenses", ["admin", "manager", "cashier"]],
  ["/reports", "Reports", ["admin", "manager"]],
  ["/shifts", "Cashier Shifts", ["admin", "manager", "cashier"]],
  ["/users", "Users", ["admin"]],
  ["/settings", "Settings", ["admin", "manager"]],
];

export default function Sidebar({ name, role }: { name: string; role: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter(([, , roles]) => roles.includes(role));

  const body = (
    <>
      <div className="flex items-center gap-3 px-4 pb-3 pt-4 text-white">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--hv)] text-sm font-black text-slate-900">AH</div>
        <div>
          <div className="font-bold leading-tight">Albright Hardware</div>
          <div className="text-xs text-slate-400">Point of sale</div>
        </div>
      </div>
      <div className="h-[3px] bg-gradient-to-r from-[var(--hv)] via-[var(--hv)] to-transparent bg-[length:8px_3px] bg-repeat-x" />
      <nav className="flex-1 overflow-auto py-2">
        {items.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`block border-l-4 px-5 py-2.5 text-sm font-medium ${
              path.startsWith(href)
                ? "border-[var(--hv)] bg-slate-700 text-white"
                : "border-transparent text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-400">
        <div className="font-semibold text-white">{name}</div>
        <div className="capitalize">{role}</div>
        <button className="btn mt-2 w-full text-xs" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        className="btn fixed left-3 top-3 z-40 md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Menu"
      >
        &#9776;
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed z-50 flex h-screen w-60 flex-col bg-[var(--steel)] transition-transform md:sticky md:top-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {body}
      </aside>
    </>
  );
}
