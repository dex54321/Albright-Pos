import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError } from "@/lib/num";

/**
 * Used by the POS payment screen when a cashier needs a manager's sign-off
 * (below-minimum price, over credit limit). The cashier stays signed in;
 * this only checks the manager's password and returns their id so it can
 * be recorded as `approvedBy` on the sale.
 */
export async function POST(req: NextRequest) {
  return withErrors(async () => {
    await requireUser("cashier"); // must already be signed in as someone
    const { username, password } = await req.json();
    const user = await prisma.user.findUnique({ where: { username: String(username ?? "").trim().toLowerCase() } });
    if (!user || !user.active || !["admin", "manager"].includes(user.role)) {
      throw new AppError("Not a valid manager account", { status: 401 });
    }
    const ok = await bcrypt.compare(String(password ?? ""), user.passwordHash);
    if (!ok) throw new AppError("Wrong password", { status: 401 });
    return { id: user.id, role: user.role };
  });
}
