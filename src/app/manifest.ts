import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Albright Hardware POS",
    short_name: "Albright POS",
    description: "Point of sale and inventory for Albright Hardware Enterprice",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#212d38",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
