import { NextRequest } from "next/server";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { receiveCustomerPayment } from "@/lib/txns";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrors(async () => {
    const user = await requireUser("cashier");
    const id = Number((await params).id);
    const body = await req.json();
    return receiveCustomerPayment({ id: user.id, name: user.name! }, { ...body, customerId: id });
  });
}
