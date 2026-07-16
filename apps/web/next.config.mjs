/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Every screen is force-dynamic (financial data must never be stale), but
  // the client Router Cache still reuses a soft-navigated page's RSC payload
  // for staleTimes.dynamic seconds (default 30s) regardless of that. Zero it
  // out so every <Link> navigation always refetches live from the server.
  experimental: {
    staleTimes: { dynamic: 0, static: 0 },
  },
  // Workspace packages ship raw TypeScript; Next transpiles them.
  transpilePackages: ['@fb/types', '@fb/engine', '@fb/data', '@fb/ai'],
  webpack: (config) => {
    // The workspace packages use ESM-style '.js' specifiers that point at '.ts'
    // sources; teach webpack to resolve them.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
