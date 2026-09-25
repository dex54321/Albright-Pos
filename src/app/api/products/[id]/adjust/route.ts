import { NextRequest } from "next/server";
import { requireUser, withErrors } from "@/lib/apiAuth";
import { adjustStock } from "@/lib/txns";
import { getSettings } from "@/lib/settings";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrors(async () => {
    const user = await requireUser("manager");
    const id = Number((await params).id);
    const settings = await getSettings();
    const body = await req.json();
    return adjustStock(
      { id: user.id, name: user.name },
      { productId: id, mode: body.mode, qty: body.qty, type: body.type, reason: body.reason },
      { allowNegative: settings.allowNegative }
    );
  });
}
