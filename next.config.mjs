/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'bcryptjs', 'jsonwebtoken'],
  },
};

export default nextConfig;
