import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(process.cwd(), "src"),
    };
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      // optional, only if your module requires synchronous wasm
      // syncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;
