import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { AppError } from "@/lib/num";

export async function GET() {
  return withErrors(async () => {
    await requireUser("cashier");
    return prisma.unit.findMany({ orderBy: { name: "asc" } });
  });
}

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    await requireUser("manager");
    const b = await req.json();
    if (!String(b.name ?? "").trim()) throw new AppError("Enter a name");
    return prisma.unit.create({ data: { name: b.name, decimal: !!b.decimal } });
  });
}
