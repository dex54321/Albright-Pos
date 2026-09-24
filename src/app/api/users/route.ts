import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError } from "@/lib/num";

export async function GET() {
  return withErrors(async () => {
    await requireUser("admin");
    return prisma.user.findMany({ select: { id: true, name: true, username: true, role: true, active: true }, orderBy: { name: "asc" } });
  });
}

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    const actor = await requireUser("admin");
    const b = await req.json();
    const username = String(b.username ?? "").trim().toLowerCase();
    if (!b.name || !username) throw new AppError("Name and username are required");
    if (!b.password || String(b.password).length < 6) throw new AppError("Password must be at least 6 characters");
    const dupe = await prisma.user.findUnique({ where: { username } });
    if (dupe) throw new AppError("That username is taken");
    const passwordHash = await bcrypt.hash(String(b.password), 10);
    const u = await prisma.user.create({
      data: { name: b.name, username, passwordHash, role: b.role || "cashier", active: b.active !== false },
    });
    await prisma.auditLog.create({ data: { userId: actor.id, userName: actor.name!, action: "User creation", ref: u.name, details: `${u.username} (${u.role})` } });
    return { id: u.id };
  });
}
