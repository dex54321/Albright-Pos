import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stkPush, normalizePhone } from "@/lib/mpesa";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const phone = normalizePhone(b.phone || "");
    const amount = Number(b.amount) || 0;
    if (phone.length !== 12) {
      return NextResponse.json({ error: "Enter a valid phone number (07XX... )" }, { status: 400 });
    }
    if (amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const result = await stkPush(phone, amount, "Albright Hardware", "POS Sale");
    await prisma.mpesaTransaction.create({
      data: { checkoutRequestId: result.CheckoutRequestID, merchantRequestId: result.MerchantRequestID, phone, amount },
    });
         return NextResponse.json({ ok: true, data: { checkoutRequestId: result.CheckoutRequestID } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "M-Pesa request failed" }, { status: 500 });
  }
}
