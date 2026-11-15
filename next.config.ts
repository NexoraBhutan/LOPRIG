import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Let the dev server be opened via this PC's network address (e.g. from a phone on the same Wi-Fi).
  // Development only; has no effect on production builds.
  allowedDevOrigins: ["10.9.93.166", "10.*.*.*", "192.168.*.*", "172.*.*.*"],
};

export default nextConfig;