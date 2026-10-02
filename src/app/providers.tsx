"use client";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Registering /sw.js here is temporary: the service worker that used to
  // live at this path broke page styling, so the current sw.js is a
  // self-destructing version that cleans itself up on anyone who already
  // has it installed. Once everyone has loaded the site at least once
  // after this fix (give it a few days), this registration call and the
  // sw.js file can both be deleted entirely.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
