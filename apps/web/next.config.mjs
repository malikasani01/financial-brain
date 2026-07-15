/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TypeScript; Next transpiles them.
  transpilePackages: ['@fb/types', '@fb/engine', '@fb/data', '@fb/ai'],
};

export default nextConfig;
