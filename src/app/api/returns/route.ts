import { NextRequest } from "next/server";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { createCustomerReturn } from "@/lib/txns";

export async function POST(req: NextRequest) {
  return withErrors(async () => {
    const user = await requireUser("cashier");
    const body = await req.json();
    return createCustomerReturn({ id: user.id, name: user.name!, role: user.role }, body);
  });
}
