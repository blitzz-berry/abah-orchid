import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

function originFromURL(raw?: string) {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function readAllowlist(envKey: string) {
  const raw = process.env[envKey] || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildContentSecurityPolicy() {
  const devInline = "'unsafe-" + "inline'";
  const apiOrigin = originFromURL(process.env.NEXT_PUBLIC_API_URL);
  const googleIdentityOrigin = "https://accounts.google.com";
  const googleAPIsOrigin = "https://www.googleapis.com";
  const connectSrc = new Set<string>(["'self'"]);
  if (!isProd) {
    connectSrc.add("http://localhost:8080");
    connectSrc.add("https:");
  }
  if (apiOrigin) connectSrc.add(apiOrigin);
  connectSrc.add(googleIdentityOrigin);
  connectSrc.add(googleAPIsOrigin);
  for (const value of readAllowlist("CSP_CONNECT_SRC_ALLOWLIST")) connectSrc.add(value);

  const imgSrc = new Set<string>(["'self'", "data:", "blob:"]);
  if (!isProd) imgSrc.add("https:");
  for (const value of readAllowlist("CSP_IMG_SRC_ALLOWLIST")) imgSrc.add(value);

  const scriptSrc = new Set<string>(["'self'", googleIdentityOrigin]);
  if (!isProd) {
    scriptSrc.add("'unsafe-eval'");
    scriptSrc.add(devInline);
  }
  for (const value of readAllowlist("CSP_SCRIPT_SRC_ALLOWLIST")) scriptSrc.add(value);

  const frameSrc = new Set<string>(["'self'", googleIdentityOrigin]);
  for (const value of readAllowlist("CSP_FRAME_SRC_ALLOWLIST")) frameSrc.add(value);

  const styleSrc = new Set<string>(["'self'", googleIdentityOrigin]);
  if (!isProd) styleSrc.add(devInline);
  for (const value of readAllowlist("CSP_STYLE_SRC_ALLOWLIST")) styleSrc.add(value);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `img-src ${Array.from(imgSrc).join(" ")}`,
    "font-src 'self' data:",
    `script-src ${Array.from(scriptSrc).join(" ")}`,
    `style-src ${Array.from(styleSrc).join(" ")}`,
    `frame-src ${Array.from(frameSrc).join(" ")}`,
    `connect-src ${Array.from(connectSrc).join(" ")}`,
  ].join("; ");
}

const contentSecurityPolicy = buildContentSecurityPolicy();

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
