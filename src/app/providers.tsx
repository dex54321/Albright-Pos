"use client";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Registers the no-op service worker in /public/sw.js. Chrome on Android
  // only offers a real "Install app" prompt (not just a browser shortcut)
  // once a service worker with a fetch handler is registered.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not fatal - the site still works normally, it just may only
        // offer a plain shortcut instead of a full install on some browsers.
      });
    }
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
