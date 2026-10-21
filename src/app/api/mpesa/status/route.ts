import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const txn = await prisma.mpesaTransaction.findUnique({ where: { checkoutRequestId: id } });
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ status: txn.status, mpesaReceipt: txn.mpesaReceipt, resultDesc: txn.resultDesc });
}
