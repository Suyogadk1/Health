/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.MINDCARE_BUILD_DIR || ".next",
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
  },
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NETLIFY === "true" ? "/.netlify/functions/mindcare" : "http://localhost:5001");
    const base = backendUrl.replace(/\/$/, "");

    return { beforeFiles: [
      { source: "/api/transcribe", destination: `${base}/api/transcribe` },
      { source: "/api/speak", destination: `${base}/api/speak` },
      {
        source: "/api/chat",
        destination: `${base}/api/chat`,
      },
      {
        source: "/api/chat/:path*",
        destination: `${base}/api/chat/:path*`,
      },
      {
        source: "/api/conversations",
        destination: `${base}/api/conversations`,
      },
      {
        source: "/api/conversations/:path*",
        destination: `${base}/api/conversations/:path*`,
      },
      {
        source: "/api/profile",
        destination: `${base}/api/profile`,
      },
      {
        source: "/api/profile/:path*",
        destination: `${base}/api/profile/:path*`,
      },
      {
        source: "/api/checkins",
        destination: `${base}/api/checkins`,
      },
      {
        source: "/api/checkins/:path*",
        destination: `${base}/api/checkins/:path*`,
      },
      {
        source: "/api/health",
        destination: `${base}/api/health`,
      },
    ] };
  },
};

module.exports = nextConfig;
