/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Short-lived client Router Cache so returning to a recently-viewed tab is
  // instant instead of a full server round-trip every time. Freshness is safe:
  // every mutation calls revalidatePath('/home','layout'), invalidating the
  // whole (app) subtree, so edits always refetch. 30s only affects navigation
  // between edits, when nothing has changed.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
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
