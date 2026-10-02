import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Albright Hardware POS",
  description: "Point of sale and inventory for Albright Hardware Enterprice",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Albright POS",
  },
};

export const viewport: Viewport = {
  themeColor: "#212d38",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-100 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
