import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const stk = body?.Body?.stkCallback;
    if (stk) {
      const checkoutRequestId = stk.CheckoutRequestID as string;
      const resultCode = stk.ResultCode as number;
      const resultDesc = stk.ResultDesc as string;
      let mpesaReceipt: string | null = null;
      if (resultCode === 0 && Array.isArray(stk.CallbackMetadata?.Item)) {
        const items = stk.CallbackMetadata.Item as { Name: string; Value?: string | number }[];
        mpesaReceipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value?.toString() ?? null;
      }
      await prisma.mpesaTransaction.updateMany({
        where: { checkoutRequestId },
        data: { status: resultCode === 0 ? "success" : "failed", mpesaReceipt, resultDesc },
      });
    }
  } catch {
    // Safaricom just needs an acknowledgment either way
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
