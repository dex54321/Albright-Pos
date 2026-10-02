import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Service worker scripts must never be cached by the browser or Vercel's
  // edge, or a broken version can keep controlling pages indefinitely even
  // after it's fixed and redeployed - this forces every request for it to
  // always go back to the server for the latest copy.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
