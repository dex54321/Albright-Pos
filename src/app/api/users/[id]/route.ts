import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError } from "@/lib/num";
import type { Role } from "@prisma/client";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrors(async () => {
    const actor = await requireUser("admin");
    const id = Number((await params).id);
    const b = await req.json();
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) throw new AppError("User not found", { status: 404 });

    if (u.role === "admin" && (b.role !== "admin" || !b.active)) {
      const otherAdmins = await prisma.user.count({ where: { role: "admin", active: true, id: { not: id } } });
      if (otherAdmins < 1) throw new AppError("You need at least one active admin");
    }

    const data: { name: string; role: Role; active: boolean; passwordHash?: string } = {
      name: b.name,
      role: b.role as Role,
      active: !!b.active,
    };
    if (b.password) {
      if (String(b.password).length < 6) throw new AppError("Password must be at least 6 characters");
      data.passwordHash = await bcrypt.hash(String(b.password), 10);
    }
    await prisma.user.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: { userId: actor.id, userName: actor.name!, action: "User edit", ref: b.name, details: `${u.username} (${b.role})${b.password ? " - password set" : ""}` },
    });
    return { ok: true };
  });
}
