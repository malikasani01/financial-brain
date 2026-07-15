/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
