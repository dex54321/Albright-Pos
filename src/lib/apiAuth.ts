import { NextResponse } from "next/server";
import { auth, atLeast } from "@/lib/auth";
import { AppError } from "@/lib/num";

export type ActingUser = {
  id: number;
  name: string;
  username: string;
  role: "admin" | "manager" | "cashier";
};

/**
 * Reads the signed-in user from the session and checks they hold at least
 * `minRole`. NextAuth stores the numeric database id as a string in the
 * session (its native id type); this is the one place that converts it
 * back to a number, so every caller downstream works with a plain number.
 */
export async function requireUser(minRole: "cashier" | "manager" | "admin" = "cashier"): Promise<ActingUser> {
  const session = await auth();
  if (!session?.user) throw new AppError("Not signed in", { status: 401 });
  if (!atLeast(session.user.role, minRole)) {
    throw new AppError("You do not have access to do that", { status: 403 });
  }
  const id = Number(session.user.id);
  if (!id || !Number.isFinite(id)) throw new AppError("Not signed in", { status: 401 });
  return {
    id,
    name: session.user.name ?? session.user.username,
    username: session.user.username,
    role: session.user.role,
  };
}

/** Wraps a route handler so any AppError becomes a clean JSON error response. */
export function withErrors<T>(fn: () => Promise<T>) {
  return fn()
    .then((data) => NextResponse.json({ ok: true, data }))
    .catch((e: unknown) => {
      const err = e as { message?: string; status?: number; needApproval?: boolean };
      const status = err.status ?? 500;
      if (status === 500) console.error(e);
      return NextResponse.json(
        { ok: false, error: err.message ?? "Something went wrong", needApproval: !!err.needApproval },
        { status }
      );
    });
}
