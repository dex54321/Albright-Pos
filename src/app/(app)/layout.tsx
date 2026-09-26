import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import { CartProvider } from "@/lib/cartStore";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <CartProvider>
      <div className="flex min-h-screen">
        <Sidebar name={session.user.name ?? session.user.username} role={session.user.role} />
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </CartProvider>
  );
}
