"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

export type CartLine = { pid: number; name: string; unit: string; qty: number; price: number; list: number; disc: number; stock: number; minSell: number };
export type CartCustomer = { id: number; name: string; phone: string | null; balance: number };

type CartState = {
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  discount: number;
  setDiscount: React.Dispatch<React.SetStateAction<number>>;
  customer: CartCustomer | null;
  setCustomer: React.Dispatch<React.SetStateAction<CartCustomer | null>>;
  clearSale: () => void;
};

const CartContext = createContext<CartState | null>(null);

const KEY = "hw_pos_cart_v1";

/**
 * Keeps the in-progress sale (cart, discount, chosen customer) alive across
 * page navigation - e.g. checking a customer's balance on the Debtors page
 * mid-sale and coming back to POS without losing what was already added.
 * Backed by sessionStorage so it also survives an accidental refresh but
 * clears itself once the browser tab is closed.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState<CartCustomer | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.cart)) setCart(saved.cart);
        if (typeof saved.discount === "number") setDiscount(saved.discount);
        if (saved.customer) setCustomer(saved.customer);
      }
    } catch {
      // ignore corrupt/unavailable storage - just start with an empty sale
    } finally {
      hydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) return; // don't overwrite saved data with the initial empty state
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ cart, discount, customer }));
    } catch {
      // storage full or unavailable - the sale still works, it just won't survive navigation
    }
  }, [cart, discount, customer]);

  function clearSale() {
    setCart([]);
    setDiscount(0);
    setCustomer(null);
  }

  return <CartContext.Provider value={{ cart, setCart, discount, setDiscount, customer, setCustomer, clearSale }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
