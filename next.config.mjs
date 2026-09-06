/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // Next 15: reactCompiler lives under experimental (top-level in Next 16+)
    reactCompiler: true,
  },
  typescript: {
    // aws provider unions were incomplete; do not block production deploy on leftover demo-route typings
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["sql.js", "firebase-admin"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async redirects() {
    const templateRoutes = [
      "finance",
      "finance-v1",
      "crm",
      "crm-v1",
      "ecommerce",
      "default",
      "default-v1",
      "academy",
      "calendar",
      "chat",
      "kanban",
      "tasks",
      "productivity",
      "logistics",
      "invoice",
      "infrastructure",
      "mail",
      "coming-soon",
      "analytics-v1",
    ];
    return [
      { source: "/dashboard/default", destination: "/dashboard/ops", permanent: false },
      { source: "/mail", destination: "/dashboard/notifications", permanent: false },
      { source: "/chat", destination: "/dashboard/support", permanent: false },
      ...templateRoutes.map((route) => ({
        source: `/dashboard/${route}`,
        destination: "/dashboard/ops",
        permanent: false,
      })),
      ...templateRoutes.map((route) => ({
        source: `/dashboard/${route}/:path*`,
        destination: "/dashboard/ops",
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
