/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — keep it external to the Next.js
  // bundler so route handlers load it directly from node_modules.
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

module.exports = nextConfig;
