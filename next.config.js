/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["prisma", "@prisma/client", "node-cron"]
  }
};

module.exports = nextConfig;
