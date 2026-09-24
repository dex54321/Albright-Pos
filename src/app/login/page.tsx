"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await signIn("credentials", { username, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setErr("Wrong username or password");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--steel)] p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white">
        <div className="h-2 bg-[var(--hv)]" />
        <div className="p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--hv)] text-lg font-black text-slate-900">
              AH
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Albright Hardware Enterprice</h1>
              <div className="text-xs text-slate-500">Point of sale &amp; inventory</div>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Username</label>
              <input className="input" autoFocus autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
            <button className="btn btn-pri w-full py-3 text-base" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <div className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            First time here? Sign in as <b>admin</b> with the password you set when you seeded the
            database, then go to Users to create accounts for your staff.
          </div>
        </div>
      </div>
    </div>
  );
}
