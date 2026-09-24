import { NextRequest } from "next/server";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { paySupplier } from "@/lib/txns";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrors(async () => {
    const user = await requireUser("manager");
    const id = Number((await params).id);
    const body = await req.json();
    return paySupplier({ id: user.id, name: user.name! }, { ...body, supplierId: id });
  });
}
