"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  LayoutDashboard,
  Sparkles,
  ShoppingCart,
  Receipt,
  Package,
  Truck,
  Factory,
  Users,
  Wallet,
  Banknote,
  BarChart3,
  Clock,
  UserCog,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const NAV: [string, string, LucideIcon, string[]][] = [
  ["/dashboard", "Dashboard", LayoutDashboard, ["admin", "manager"]],
  ["/assistant", "Shop Assistant", Sparkles, ["admin", "manager"]],
  ["/pos", "POS", ShoppingCart, ["admin", "manager", "cashier"]],
  ["/sales", "Sales & Returns", Receipt, ["admin", "manager", "cashier"]],
  ["/products", "Products", Package, ["admin", "manager"]],
  ["/purchases", "Purchases", Truck, ["admin", "manager"]],
  ["/suppliers", "Suppliers", Factory, ["admin", "manager"]],
  ["/customers", "Customers", Users, ["admin", "manager", "cashier"]],
  ["/debtors", "Credit / Debtors", Wallet, ["admin", "manager", "cashier"]],
  ["/expenses", "Expenses", Banknote, ["admin", "manager", "cashier"]],
  ["/reports", "Reports", BarChart3, ["admin", "manager"]],
  ["/shifts", "Cashier Shifts", Clock, ["admin", "manager", "cashier"]],
  ["/users", "Users", UserCog, ["admin"]],
  ["/settings", "Settings", Settings, ["admin", "manager"]],
];

export default function Sidebar({ name, role }: { name: string; role: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter(([, , , roles]) => roles.includes(role));

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
        {items.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 border-l-4 px-5 py-2.5 text-sm font-medium ${
              path.startsWith(href)
                ? "border-[var(--hv)] bg-slate-700 text-white"
                : "border-transparent text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            <Icon size={18} strokeWidth={2} className="shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-400">
        <div className="font-semibold text-white">{name}</div>
        <div className="capitalize">{role}</div>
        <button className="btn mt-2 flex w-full items-center justify-center gap-1.5 text-xs" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut size={14} />
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
