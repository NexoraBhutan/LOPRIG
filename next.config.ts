import type { NextConfig } from "next";

// Where this server forwards /api/... and /media/... when NEXT_PUBLIC_API_URL is the relative
// "/api/v1": the browser then only ever talks to this site's own address, which keeps working
// over https tunnels, other networks and phones (an https page may not call a plain http API).
const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Let the dev server be opened via this PC's network address (e.g. from a phone on the same Wi-Fi)
  // or a VS Code dev tunnel. Development only; has no effect on production builds.
  allowedDevOrigins: ["10.9.93.166", "10.*.*.*", "192.168.*.*", "172.*.*.*", "*.devtunnels.ms"],
  // Django's addresses end in "/"; Next.js would otherwise redirect them to the slash-less form.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // ":path*" drops a trailing "/", so match it explicitly first and pass it on.
      { source: "/api/:path*/", destination: `${API_PROXY_TARGET}/api/:path*/` },
      { source: "/api/:path*", destination: `${API_PROXY_TARGET}/api/:path*` },
      { source: "/media/:path*", destination: `${API_PROXY_TARGET}/media/:path*` },
    ];
  },
};

export default nextConfig;