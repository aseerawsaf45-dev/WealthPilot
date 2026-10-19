import type { NextConfig } from "next";

// Static CSP: nonce-based CSP is incompatible with cacheComponents/PPR (bundled Next docs).
// Trade-off: 'unsafe-inline' scripts weaken XSS protection; the HttpOnly cookie-only session limits the damage.
// Dev needs 'unsafe-eval' for React's debugging tools and HMR.
const csp = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets on-device OCR (tesseract.js) compile WebAssembly; it does not allow JS eval().
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  // OCR / PDF / HEIC readers run in Web Workers (self-hosted files under /vendor, or blob: workers).
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["192.168.0.100", "localhost", "127.0.0.1"],
  experimental: {
    // Limit worker processes during build so multi-core hosts (e.g. Hostinger with 44+ cores)
    // do not exhaust container process/thread limits (Tokio os error 11 / SIGABRT) during page data collection.
    cpus: process.env.NEXT_CPUS ? parseInt(process.env.NEXT_CPUS, 10) : 2,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
