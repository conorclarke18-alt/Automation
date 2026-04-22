/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = [...(config.externals || []), { esbuild: 'esbuild' }];
    return config;
  },
  serverExternalPackages: [
    '@remotion/bundler',
    '@remotion/renderer',
  ],
};

module.exports = nextConfig;
